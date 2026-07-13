from __future__ import annotations

import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app.services.agent.openai_compat import Provider
from app.services.agent.style_tips import (
    generate_style_tips,
    wardrobe_fingerprint,
)
from app.v1.schemas import StyleTip

_TEXT_PROVIDER = Provider(
    name="DeepSeek",
    base_url="https://deepseek.test",
    api_key="ds-test",
    model="deepseek-chat",
    flatten_content=True,
)

_ITEMS = [
    {"id": "1", "name": "Navy Blazer", "category": "Outerwear", "color": "navy", "brand": "Zara", "is_favorite": True},
    {"id": "2", "name": "White Tee", "category": "Tops", "color": "white", "brand": None, "is_favorite": False},
]


def _payload(content: str) -> dict:
    return {"choices": [{"message": {"role": "assistant", "content": content}}]}


class GenerateStyleTipsTestCase(unittest.TestCase):
    """Unit tests for the tips service (no network, provider mocked)."""

    def _run(self, content: str) -> list[StyleTip]:
        with patch(
            "app.services.agent.style_tips.deepseek_provider",
            return_value=_TEXT_PROVIDER,
        ), patch(
            "app.services.agent.style_tips.post_chat",
            return_value=_payload(content),
        ):
            return generate_style_tips(_ITEMS)

    def test_parses_valid_json(self) -> None:
        tips = self._run(
            '{"tips": ['
            '{"title": "Dress up the tee", "description": "Layer the navy blazer '
            'over your white tee.", "kind": "pairing"}]}'
        )

        self.assertEqual(len(tips), 1)
        self.assertEqual(tips[0].title, "Dress up the tee")
        self.assertEqual(tips[0].kind, "pairing")

    def test_coerces_off_list_kind_to_none(self) -> None:
        tips = self._run(
            '{"tips": [{"title": "Nice look", "description": "Great combo.", '
            '"kind": "sparkle"}]}'
        )

        self.assertEqual(len(tips), 1)
        self.assertIsNone(tips[0].kind)

    def test_parses_markdown_fenced_json(self) -> None:
        tips = self._run(
            '```json\n{"tips": [{"title": "Keep it crisp", '
            '"description": "White tees pair with everything.", "kind": "versatility"}]}\n```'
        )

        self.assertEqual(len(tips), 1)
        self.assertEqual(tips[0].kind, "versatility")

    def test_caps_tips_at_max(self) -> None:
        many = ", ".join(
            f'{{"title": "Tip {i}", "description": "Body {i}.", "kind": "color"}}'
            for i in range(10)
        )
        tips = self._run(f'{{"tips": [{many}]}}')

        self.assertEqual(len(tips), 5)

    def test_skips_entries_missing_fields(self) -> None:
        tips = self._run(
            '{"tips": ['
            '{"title": "", "description": "No title."},'
            '{"title": "Valid", "description": "Kept.", "kind": "occasion"}]}'
        )

        self.assertEqual(len(tips), 1)
        self.assertEqual(tips[0].title, "Valid")

    def test_raises_502_on_malformed_output(self) -> None:
        with self.assertRaises(HTTPException) as ctx:
            self._run("Here are some tips, but not JSON.")

        self.assertEqual(ctx.exception.status_code, 502)
        self.assertEqual(ctx.exception.detail, "Could not generate style tips.")

    def test_raises_502_when_no_valid_tips(self) -> None:
        with self.assertRaises(HTTPException) as ctx:
            self._run('{"tips": []}')

        self.assertEqual(ctx.exception.status_code, 502)

    def test_requests_json_object(self) -> None:
        with patch(
            "app.services.agent.style_tips.deepseek_provider",
            return_value=_TEXT_PROVIDER,
        ), patch(
            "app.services.agent.style_tips.post_chat",
            return_value=_payload('{"tips": [{"title": "X", "description": "Y"}]}'),
        ) as post_mock:
            generate_style_tips(_ITEMS)

        (_provider, body), _ = post_mock.call_args
        self.assertEqual(body["response_format"], {"type": "json_object"})


class WardrobeFingerprintTestCase(unittest.TestCase):
    """The coarse fingerprint only changes on 'large' wardrobe changes."""

    def test_deterministic_regardless_of_order(self) -> None:
        reversed_items = list(reversed(_ITEMS))
        self.assertEqual(
            wardrobe_fingerprint(_ITEMS), wardrobe_fingerprint(reversed_items)
        )

    def test_stable_under_rename_brand_and_favorite_edits(self) -> None:
        base = wardrobe_fingerprint(_ITEMS)
        edited = [
            {**_ITEMS[0], "name": "Renamed", "brand": "Uniqlo", "is_favorite": False},
            _ITEMS[1],
        ]
        self.assertEqual(base, wardrobe_fingerprint(edited))

    def test_changes_when_item_added(self) -> None:
        base = wardrobe_fingerprint(_ITEMS)
        added = _ITEMS + [
            {"id": "3", "name": "Loafers", "category": "Shoes", "color": "brown", "brand": None, "is_favorite": False}
        ]
        self.assertNotEqual(base, wardrobe_fingerprint(added))

    def test_changes_when_item_removed(self) -> None:
        base = wardrobe_fingerprint(_ITEMS)
        self.assertNotEqual(base, wardrobe_fingerprint(_ITEMS[:1]))

    def test_changes_when_color_changes(self) -> None:
        base = wardrobe_fingerprint(_ITEMS)
        recolored = [{**_ITEMS[0], "color": "black"}, _ITEMS[1]]
        self.assertNotEqual(base, wardrobe_fingerprint(recolored))

    def test_empty_wardrobe_is_deterministic(self) -> None:
        self.assertEqual(wardrobe_fingerprint([]), wardrobe_fingerprint([]))


if __name__ == "__main__":
    unittest.main()
