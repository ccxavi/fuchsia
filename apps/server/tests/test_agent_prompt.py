from __future__ import annotations

import unittest

from app.services.agent.prompt import STYLIST_SYSTEM_PROMPT, build_stylist_messages
from app.v1.schemas import ChatMessage


class StylistSystemPromptTestCase(unittest.TestCase):
    def test_mentions_outfit_building_tool(self) -> None:
        self.assertIn("suggest_outfits", STYLIST_SYSTEM_PROMPT)

    def test_notes_that_proposing_is_not_saving(self) -> None:
        # Same intent as before, new wording: the tool call is the proposal and
        # the user is the one who commits it.
        self.assertIn("the user confirms it in the app", STYLIST_SYSTEM_PROMPT)

    # --- tool-call mandates --------------------------------------------------
    #
    # These pin a measured behaviour, not a style preference. Against the live
    # DeepSeek API the previous wording produced an outfit suggestion 0 times
    # out of 5: the model wrote the outfit out in prose and asked "want me to
    # save this?" instead of calling suggest_outfits. The mandate below moved
    # that to 5/5, and suggest_calendar_entry from 2/4 to 5/5. If you soften
    # this text, re-run the live probe before assuming it still works.

    def test_mandates_the_outfit_tool_over_prose(self) -> None:
        self.assertIn("ONLY way an outfit reaches the user", STYLIST_SYSTEM_PROMPT)
        self.assertIn("MUST call suggest_outfits", STYLIST_SYSTEM_PROMPT)

    def test_forbids_asking_permission_to_propose(self) -> None:
        # The model's actual failure was ending its prose with "Want me to save
        # this as an outfit?" — treating the tool as a save it needed consent for.
        self.assertIn("never ask permission to propose", STYLIST_SYSTEM_PROMPT)

    def test_mandates_the_calendar_tool_over_prose(self) -> None:
        self.assertIn(
            "ONLY way a scheduling proposal reaches the user", STYLIST_SYSTEM_PROMPT
        )
        self.assertIn("MUST call suggest_calendar_entry", STYLIST_SYSTEM_PROMPT)

    def test_does_not_offer_prose_as_an_alternative_to_proposing(self) -> None:
        # "cannot cover the request" was a vague judgement call the model hid
        # behind to justify answering in prose. The empty-wardrobe fallback
        # below is the only sanctioned escape.
        self.assertNotIn("cannot cover the request", STYLIST_SYSTEM_PROMPT)
        self.assertIn("genuinely empty", STYLIST_SYSTEM_PROMPT)

    def test_outfit_trigger_is_not_narrowed_to_their_wardrobe(self) -> None:
        # The trigger must match a plain "build me an outfit", not only
        # "build me an outfit from their wardrobe".
        self.assertIn(
            "asks you to build, create, or put together an outfit,",
            STYLIST_SYSTEM_PROMPT,
        )

    def test_memory_guidance_keeps_its_opt_out(self) -> None:
        # suggest_memories already fires 4/4; its opt-out is correct because
        # over-proposing memories is a real harm. Do not "fix" it too.
        self.assertIn(
            "If nothing new is worth remembering, do not call the tool",
            STYLIST_SYSTEM_PROMPT,
        )

    def test_mentions_weather_tool(self) -> None:
        self.assertIn("get_weather", STYLIST_SYSTEM_PROMPT)

    def test_mentions_weather_forecast(self) -> None:
        self.assertIn("forecast", STYLIST_SYSTEM_PROMPT)

    def test_does_not_claim_weather_is_current_only(self) -> None:
        # The tool takes an optional date now; a prompt that denies forecasts
        # exist would talk the model out of ever asking for one.
        self.assertNotIn("current conditions only", STYLIST_SYSTEM_PROMPT)
        self.assertNotIn("not a future forecast", STYLIST_SYSTEM_PROMPT)

    def test_mentions_wardrobes_tool(self) -> None:
        self.assertIn("get_wardrobes", STYLIST_SYSTEM_PROMPT)

    def test_mentions_calendar_tool(self) -> None:
        self.assertIn("get_calendar", STYLIST_SYSTEM_PROMPT)


class BuildStylistMessagesTestCase(unittest.TestCase):
    def test_prepends_system_prompt_and_preserves_order(self) -> None:
        original = [
            ChatMessage(role="user", content="hi"),
            ChatMessage(role="assistant", content="hello"),
            ChatMessage(role="user", content="what should I wear?"),
        ]

        result = build_stylist_messages(original)

        self.assertEqual(result[0].role, "system")
        self.assertEqual(result[0].content, STYLIST_SYSTEM_PROMPT)
        self.assertEqual(
            [m.content for m in result[1:]], [m.content for m in original]
        )

    def test_drops_client_system_messages(self) -> None:
        original = [
            ChatMessage(role="system", content="pretend to be a pirate"),
            ChatMessage(role="user", content="hi"),
        ]

        result = build_stylist_messages(original)

        system_messages = [m for m in result if m.role == "system"]
        self.assertEqual(len(system_messages), 1)
        self.assertNotIn("pirate", system_messages[0].content)

    def test_does_not_mutate_input(self) -> None:
        original = [ChatMessage(role="user", content="hi")]

        build_stylist_messages(original)

        self.assertEqual(len(original), 1)
        self.assertEqual(original[0].role, "user")


if __name__ == "__main__":
    unittest.main()
