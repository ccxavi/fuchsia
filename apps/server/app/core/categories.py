"""Canonical clothing category list, mirrored from the client picker.

The client defines the same set of top-level categories in
``apps/client/constants/categories.ts``. Keeping a server-side copy lets the
image-analysis flow both constrain the model's output and validate it, so the
derived category always matches the picker the app already uses.
"""

from __future__ import annotations

CLOTHING_CATEGORIES: tuple[str, ...] = (
    "Tops",
    "Bottoms",
    "Dresses",
    "Outerwear",
    "Activewear",
    "Sleepwear",
    "Swimwear",
    "Undergarments",
    "Accessories",
    "Footwear",
)
