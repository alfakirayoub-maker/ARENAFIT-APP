#!/usr/bin/env python3
"""
Prepares the temporary presentation photos (presentation/README.md).

Reads the raw downloads in presentation/source/<slot>.<jpg|jpeg|png|webp>
(git-ignored), and writes presentation/images/<file> for every slot of
presentation/manifest.json:

* crop to 16:10 around the slot's optional "focus" [x, y] (0–1, default centre),
* resize to 1600×1000,
* one shared grade so the set reads as one shoot on the dark UI: slightly
  desaturated, a touch more contrast, deeper shadows,
* JPEG quality 80, progressive, no metadata (EXIF, GPS, camera data stripped).

Usage: python3 scripts/presentation/prepare.py
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageEnhance, ImageOps

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = json.loads((ROOT / "presentation/manifest.json").read_text())
SRC = ROOT / "presentation/source"
OUT = ROOT / "presentation/images"
W, H = 1600, 1000


def grade(img: Image.Image) -> Image.Image:
    img = ImageEnhance.Color(img).enhance(0.82)
    img = ImageEnhance.Contrast(img).enhance(1.08)
    # Deeper shadows, highlights untouched: a gentle curve on every channel.
    lut = [round(255 * ((i / 255) ** 1.12)) for i in range(256)]
    return img.point(lut * 3)


def crop(img: Image.Image, focus: list[float]) -> Image.Image:
    fx, fy = focus
    scale = max(W / img.width, H / img.height)
    img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    left = min(max(round(img.width * fx - W / 2), 0), img.width - W)
    top = min(max(round(img.height * fy - H / 2), 0), img.height - H)
    return img.crop((left, top, left + W, top + H))


def main() -> int:
    OUT.mkdir(exist_ok=True)
    missing = []
    for slot, spec in MANIFEST["images"].items():
        sources = [p for p in SRC.glob(f"{slot}.*") if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}]
        if not sources:
            missing.append(slot)
            continue
        img = ImageOps.exif_transpose(Image.open(sources[0])).convert("RGB")
        if img.width < W or img.height < H * 0.9:
            print(f"! {slot}: source is only {img.width}×{img.height}, it will look soft", file=sys.stderr)
        out = grade(crop(img, spec.get("focus", [0.5, 0.5])))
        target = OUT / spec["file"]
        out.save(target, "JPEG", quality=80, progressive=True, optimize=True)
        print(f"✓ {slot} → {target.relative_to(ROOT)} ({target.stat().st_size // 1024} KB)")
    if missing:
        print(f"· no source yet for: {', '.join(missing)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
