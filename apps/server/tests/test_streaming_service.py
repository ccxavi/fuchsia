from __future__ import annotations

import json
import unittest
from contextlib import ExitStack, contextmanager
from typing import Any
from unittest.mock import patch

from fastapi import HTTPException

from app.services.agent.openai_compat import Provider
from app.services.agent.streaming import (
    TOOL_STATUS_LABELS,
    _merge_tool_call_deltas,
    _sse,
    stream_stylist_chat,
)
from app.v1.schemas import ChatMessage

_PROVIDER = Provider(
    name="DeepSeek",
    base_url="https://api.deepseek.com",
    api_key="sk-test",
    model="deepseek-chat",
    flatten_content=True,
)


def _chunk(
    *,
    content: str | None = None,
    tool_calls: list[dict[str, Any]] | None = None,
    model: str = "deepseek-chat",
    usage: dict[str, Any] | None = None,
) -> dict[str, Any]:
    delta: dict[str, Any] = {}
    if content is not None:
        delta["content"] = content
    if tool_calls is not None:
        delta["tool_calls"] = tool_calls
    chunk: dict[str, Any] = {"model": model, "choices": [{"index": 0, "delta": delta}]}
    if usage is not None:
        chunk["usage"] = usage
    return chunk


def _usage_chunk(usage: dict[str, Any]) -> dict[str, Any]:
    # The trailing include_usage chunk carries usage with an empty choices list.
    return {"model": "deepseek-chat", "choices": [], "usage": usage}


def _tool_fragment(index: int, *, id: str = "", name: str = "", args: str = "") -> dict[str, Any]:
    fragment: dict[str, Any] = {"index": index, "function": {}}
    if id:
        fragment["id"] = id
    if name:
        fragment["function"]["name"] = name
    if args:
        fragment["function"]["arguments"] = args
    return fragment


def _parse_frames(raw: list[str]) -> list[tuple[str, dict[str, Any]]]:
    """Turn a list of emitted SSE strings into (event, data) tuples."""
    frames: list[tuple[str, dict[str, Any]]] = []
    for block in "".join(raw).split("\n\n"):
        block = block.strip()
        if not block:
            continue
        lines = block.split("\n")
        event = lines[0][len("event: "):]
        data = json.loads(lines[1][len("data: "):])
        frames.append((event, data))
    return frames


class StreamingHelpersTestCase(unittest.TestCase):
    def test_sse_frames_event_and_json_data(self) -> None:
        frame = _sse("token", {"text": "hi"})
        self.assertEqual(frame, 'event: token\ndata: {"text": "hi"}\n\n')

    def test_merge_reassembles_streamed_tool_call_fragments(self) -> None:
        slots: dict[int, dict[str, Any]] = {}
        _merge_tool_call_deltas(slots, [_tool_fragment(0, id="call_1", name="web_search")])
        _merge_tool_call_deltas(slots, [_tool_fragment(0, args='{"query":')])
        _merge_tool_call_deltas(slots, [_tool_fragment(0, args='"boots"}')])

        self.assertEqual(slots[0]["id"], "call_1")
        self.assertEqual(slots[0]["function"]["name"], "web_search")
        self.assertEqual(slots[0]["function"]["arguments"], '{"query":"boots"}')


class StreamStylistChatTestCase(unittest.TestCase):
    @contextmanager
    def _env(self, *, stream_side_effect: Any):
        """Patch the upstream stream and every DB-touching collaborator."""
        with ExitStack() as stack:
            stream_mock = stack.enter_context(
                patch(
                    "app.services.agent.streaming.stream_chat",
                    side_effect=stream_side_effect,
                )
            )
            # No memory RAG in unit tests.
            stack.enter_context(
                patch("app.services.agent.streaming._inject_memory_context", return_value=[])
            )
            execute_mock = stack.enter_context(
                patch(
                    "app.services.agent.loop.execute_tool",
                    return_value=json.dumps({"results": []}),
                )
            )
            audit_mock = stack.enter_context(
                patch("app.services.agent.loop.record_agent_invocation")
            )
            stack.enter_context(
                patch("app.services.agent.streaming.record_agent_invocation", audit_mock)
            )
            # Suggestion validators become identity so no DB is needed.
            stack.enter_context(
                patch(
                    "app.services.agent.loop.drop_stored_suggestions",
                    side_effect=lambda db, user_id, items: items,
                )
            )
            stack.enter_context(
                patch(
                    "app.services.agent.loop.filter_valid_outfit_suggestions",
                    side_effect=lambda db, user_id, items: items,
                )
            )
            stack.enter_context(
                patch(
                    "app.services.agent.loop.filter_valid_calendar_suggestions",
                    side_effect=lambda db, user_id, items: items,
                )
            )
            yield stream_mock, execute_mock, audit_mock

    def _run(self, stream_side_effect: Any) -> tuple[list[tuple[str, dict]], Any, Any]:
        with self._env(stream_side_effect=stream_side_effect) as (_, execute_mock, audit_mock):
            frames = _parse_frames(
                list(
                    stream_stylist_chat(
                        [ChatMessage(role="user", content="hi")],
                        provider=_PROVIDER,
                        db=None,
                        user_id="user-1",
                    )
                )
            )
        return frames, execute_mock, audit_mock

    def test_phases_tokens_then_done_in_order(self) -> None:
        round_1 = [
            _chunk(
                tool_calls=[_tool_fragment(0, id="c1", name="web_search", args='{"query":"boots"}')]
            ),
        ]
        round_2 = [
            _chunk(content="You could "),
            _chunk(content="wear boots."),
            _usage_chunk({"total_tokens": 12}),
        ]

        frames, execute_mock, audit_mock = self._run([round_1, round_2])

        events = [event for event, _ in frames]
        # The stream opens with a thinking phase.
        self.assertEqual(frames[0], ("phase", {"phase": "thinking"}))
        # The tool round announces the tool it is running.
        self.assertIn(
            ("phase", {"phase": "acting", "tool": "web_search", "label": "Searching the web"}),
            frames,
        )
        # A responding phase immediately precedes the first token.
        first_token = events.index("token")
        self.assertEqual(frames[first_token - 1], ("phase", {"phase": "responding"}))
        # Acting comes before responding, which comes before the tokens.
        acting_idx = next(
            i for i, (e, d) in enumerate(frames) if e == "phase" and d["phase"] == "acting"
        )
        self.assertLess(acting_idx, first_token - 1)
        # Tokens stream in order and reassemble into the final message.
        tokens = [data["text"] for event, data in frames if event == "token"]
        self.assertEqual("".join(tokens), "You could wear boots.")
        # Terminal done frame carries the reconciled ChatResponse.
        self.assertEqual(events[-1], "done")
        done = frames[-1][1]
        self.assertEqual(done["message"], {"role": "assistant", "content": "You could wear boots."})
        self.assertEqual(done["model"], "deepseek-chat")
        self.assertEqual(done["memory_suggestions"], [])
        self.assertEqual(done["outfit_suggestions"], [])
        # The web_search tool ran with reassembled arguments.
        name, arguments = execute_mock.call_args.args
        self.assertEqual(name, "web_search")
        self.assertEqual(arguments, {"query": "boots"})
        # A success invocation was audited.
        self.assertEqual(audit_mock.call_args.kwargs["status"], "success")

    def test_output_only_tool_emits_remembering_acting_phase(self) -> None:
        round_1 = [
            _chunk(
                tool_calls=[
                    _tool_fragment(
                        0,
                        id="c1",
                        name="suggest_memories",
                        args=json.dumps({"memories": [{"content": "Loves linen"}]}),
                    )
                ]
            ),
        ]
        round_2 = [_chunk(content="Noted!")]

        frames, execute_mock, _ = self._run([round_1, round_2])

        acting = [data for event, data in frames if event == "phase" and data["phase"] == "acting"]
        self.assertEqual(
            acting[0], {"phase": "acting", "tool": "suggest_memories", "label": "Remembering"}
        )
        # Output-only tools never reach execute_tool; the loop handles them inline.
        execute_mock.assert_not_called()
        self.assertEqual(frames[-1][0], "done")

    def test_upstream_failure_emits_error_frame_and_audits(self) -> None:
        def boom(provider, body):
            raise HTTPException(status_code=502, detail="Failed to reach DeepSeek.")

        frames, _, audit_mock = self._run(boom)

        # A thinking phase opens the stream before the upstream call fails.
        self.assertEqual(frames[0], ("phase", {"phase": "thinking"}))
        self.assertEqual(frames[-1], ("error", {"detail": "Failed to reach DeepSeek."}))
        self.assertEqual(audit_mock.call_args.kwargs["status"], "error")

    def test_empty_final_answer_becomes_error_frame(self) -> None:
        # A round with no tool calls and no content is a degenerate answer.
        round_1 = [_chunk(content="")]

        frames, _, audit_mock = self._run([round_1])

        self.assertEqual(frames[-1][0], "error")
        self.assertIn("empty", frames[-1][1]["detail"].lower())
        self.assertEqual(audit_mock.call_args.kwargs["status"], "error")

    def test_every_tool_has_a_status_label(self) -> None:
        from app.services.agent.tools import STYLIST_TOOLS

        for tool in STYLIST_TOOLS:
            self.assertIn(tool["function"]["name"], TOOL_STATUS_LABELS)


if __name__ == "__main__":
    unittest.main()
