from __future__ import annotations

import unittest
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.base import Base
from app.models.clothing_item import ClothingItem
from app.models.memory import Memory
from app.services.agent.loop import MAX_TOOL_ROUNDS, run_stylist_chat
from app.services.agent.openai_compat import Provider
from app.v1.schemas import ChatMessage


def _provider() -> Provider:
    return Provider(
        name="Test",
        base_url="https://example.test",
        api_key="key",
        model="test-model",
        flatten_content=True,
    )


def _tool_call_payload() -> dict:
    return {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [
                        {
                            "id": "call_1",
                            "type": "function",
                            "function": {
                                "name": "get_clothing_items",
                                "arguments": "{}",
                            },
                        }
                    ],
                }
            }
        ]
    }


def _content_payload(content: str = "Here are some ideas.") -> dict:
    return {
        "model": "test-model",
        "choices": [{"message": {"role": "assistant", "content": content}}],
        "usage": {"total_tokens": 10},
    }


class RunStylistChatTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.session = Session(bind=self.engine)
        self.session.add(
            ClothingItem(user_id="user-1", name="Blue jeans", category="Bottoms")
        )
        self.session.commit()
        # The memory-extraction pass is exercised in test_agent_memory.py; here we
        # isolate the answer-generation loop so post_chat call counts are exact.
        extract_patcher = patch(
            "app.services.agent.loop.extract_memory_suggestions", return_value=[]
        )
        self.mock_extract = extract_patcher.start()
        self.addCleanup(extract_patcher.stop)
        # RAG retrieval is exercised in test_agent_recall.py; default it to a miss
        # so the answer-generation loop stays isolated and post_chat counts exact.
        recall_patcher = patch(
            "app.services.agent.loop.retrieve_relevant_memories", return_value=[]
        )
        self.mock_recall = recall_patcher.start()
        self.addCleanup(recall_patcher.stop)

    def tearDown(self) -> None:
        self.session.close()
        self.engine.dispose()

    def _run(self):
        return run_stylist_chat(
            [ChatMessage(role="user", content="what do I own?")],
            provider=_provider(),
            db=self.session,
            user_id="user-1",
        )

    def test_returns_content_without_tool_calls(self) -> None:
        with patch(
            "app.services.agent.loop.post_chat",
            return_value=_content_payload("You have great style."),
        ) as post_mock:
            result = self._run()

        self.assertEqual(result.message.content, "You have great style.")
        self.assertEqual(result.memory_suggestions, [])
        post_mock.assert_called_once()

    def test_attaches_extracted_memory_suggestions(self) -> None:
        from app.v1.schemas import MemorySuggestion

        self.mock_extract.return_value = [
            MemorySuggestion(content="Never wears heels", category="preference")
        ]

        with patch(
            "app.services.agent.loop.post_chat",
            return_value=_content_payload("Let's find you flats."),
        ):
            result = self._run()

        self.assertEqual(len(result.memory_suggestions), 1)
        self.assertEqual(result.memory_suggestions[0].content, "Never wears heels")
        # Extraction is fed the original conversation, not tool-loop scaffolding.
        (extract_messages,), extract_kwargs = self.mock_extract.call_args
        self.assertEqual(extract_messages[0].content, "what do I own?")
        self.assertIn("provider", extract_kwargs)

    def test_executes_tool_then_returns_final_answer(self) -> None:
        with patch(
            "app.services.agent.loop.post_chat",
            side_effect=[_tool_call_payload(), _content_payload("You own blue jeans.")],
        ) as post_mock:
            result = self._run()

        self.assertEqual(result.message.content, "You own blue jeans.")
        self.assertEqual(post_mock.call_count, 2)

        # Second round must feed the tool result back to the model.
        _, second_body = post_mock.call_args_list[1].args
        roles = [message["role"] for message in second_body["messages"]]
        self.assertIn("tool", roles)
        tool_message = next(m for m in second_body["messages"] if m["role"] == "tool")
        self.assertEqual(tool_message["tool_call_id"], "call_1")
        self.assertIn("Blue jeans", tool_message["content"])

    def _seed_memory(self, content: str, category: str | None) -> Memory:
        memory = Memory(user_id="user-1", content=content, category=category)
        self.session.add(memory)
        self.session.commit()
        self.session.refresh(memory)
        return memory

    def test_injects_retrieved_memories_into_system_prompt(self) -> None:
        memory = self._seed_memory("Never wears heels", "preference")
        self.mock_recall.return_value = [memory]
        messages = [
            ChatMessage(role="system", content="PERSONA"),
            ChatMessage(role="user", content="what should I wear tonight?"),
        ]

        with patch(
            "app.services.agent.loop.post_chat",
            return_value=_content_payload("Try flats."),
        ) as post_mock:
            result = run_stylist_chat(
                messages, provider=_provider(), db=self.session, user_id="user-1"
            )

        # Retrieval is keyed off the latest user message.
        recall_args, _ = self.mock_recall.call_args
        self.assertEqual(recall_args[2], "what should I wear tonight?")

        # The block is folded into the leading system message.
        _, first_body = post_mock.call_args_list[0].args
        system_message = first_body["messages"][0]
        self.assertEqual(system_message["role"], "system")
        self.assertIn("PERSONA", system_message["content"])
        self.assertIn("Never wears heels", system_message["content"])

        # The used memories are surfaced on the response.
        self.assertEqual([m.content for m in result.memories_used], ["Never wears heels"])
        self.assertEqual(result.memories_used[0].category, "preference")

    def test_leaves_system_prompt_unchanged_when_no_memories(self) -> None:
        messages = [
            ChatMessage(role="system", content="PERSONA"),
            ChatMessage(role="user", content="hi"),
        ]

        with patch(
            "app.services.agent.loop.post_chat",
            return_value=_content_payload("Hello!"),
        ) as post_mock:
            result = run_stylist_chat(
                messages, provider=_provider(), db=self.session, user_id="user-1"
            )

        _, first_body = post_mock.call_args_list[0].args
        self.assertEqual(first_body["messages"][0]["content"], "PERSONA")
        self.assertEqual(result.memories_used, [])

    def test_falls_back_to_no_tools_after_max_rounds(self) -> None:
        payloads = [_tool_call_payload()] * MAX_TOOL_ROUNDS + [
            _content_payload("Final answer.")
        ]

        with patch(
            "app.services.agent.loop.post_chat", side_effect=payloads
        ) as post_mock:
            result = self._run()

        self.assertEqual(result.message.content, "Final answer.")
        self.assertEqual(post_mock.call_count, MAX_TOOL_ROUNDS + 1)

        # The final, forced request must omit tools.
        _, final_body = post_mock.call_args_list[-1].args
        self.assertNotIn("tools", final_body)


if __name__ == "__main__":
    unittest.main()
