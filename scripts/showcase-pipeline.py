#!/usr/bin/env python3
"""
Build showcase images for each pipeline test case.

For every case in output/pipeline-test/full/, produce one large PNG containing:
  [Requirement text]  [Vector Reference]  [Final Generated Image]

Outputs go to output/pipeline-test/showcase/.
"""

import json
import textwrap
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

FULL_DIR = Path("output/pipeline-test/full")
SHOWCASE_DIR = Path("output/pipeline-test/showcase")
SHOWCASE_DIR.mkdir(parents=True, exist_ok=True)

# Layout constants
PANEL_SIZE = 640            # square panel for each image
TEXT_PANEL_W = 700
HEADER_H = 110
CAPTION_H = 110
PADDING = 24
GAP = 20
BG = (248, 250, 252)
HEADER_BG = (30, 41, 59)
HEADER_FG = (255, 255, 255)
LABEL_BG = (226, 232, 240)
LABEL_FG = (30, 41, 59)
BODY_FG = (51, 65, 85)
SUBTLE = (100, 116, 139)


def load_font(size, bold=False):
    """Try several common macOS fonts; fall back to default."""
    candidates = [
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size, index=1 if bold else 0)
        except (OSError, IOError):
            try:
                return ImageFont.truetype(path, size)
            except (OSError, IOError):
                continue
    return ImageFont.load_default()


def fit_image_square(img_path: Path, size: int) -> Image.Image:
    im = Image.open(img_path).convert("RGB")
    im.thumbnail((size, size), Image.LANCZOS)
    # Pad to square
    canvas = Image.new("RGB", (size, size), (255, 255, 255))
    ox = (size - im.width) // 2
    oy = (size - im.height) // 2
    canvas.paste(im, (ox, oy))
    return canvas


def draw_panel_label(draw, x, y, w, text, font):
    draw.rectangle([x, y, x + w, y + 30], fill=LABEL_BG)
    draw.text((x + 10, y + 5), text, fill=LABEL_FG, font=font)


def wrap_text_lines(text, font, max_width, draw):
    words = text.split()
    lines = []
    current = ""
    for w in words:
        trial = (current + " " + w).strip()
        bbox = draw.textbbox((0, 0), trial, font=font)
        if bbox[2] - bbox[0] <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = w
    if current:
        lines.append(current)
    return lines


def build_showcase(case_key: str):
    item_path = FULL_DIR / f"{case_key}_item.json"
    scene_path = FULL_DIR / f"{case_key}_scene.json"
    ref_path = FULL_DIR / f"{case_key}_reference.png"
    final_path = FULL_DIR / f"{case_key}_final.webp"

    item = json.loads(item_path.read_text())
    scene = json.loads(scene_path.read_text())

    # Total canvas width: 3 panels + gaps + padding
    W = PADDING + TEXT_PANEL_W + GAP + PANEL_SIZE + GAP + PANEL_SIZE + PADDING
    H = HEADER_H + PADDING + 30 + PANEL_SIZE + PADDING + CAPTION_H

    canvas = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(canvas)

    # ---------------- Header ----------------
    draw.rectangle([0, 0, W, HEADER_H], fill=HEADER_BG)
    title_font = load_font(30, bold=True)
    subtitle_font = load_font(18)
    draw.text(
        (PADDING, 20),
        item.get("title", case_key),
        fill=HEADER_FG,
        font=title_font,
    )
    draw.text(
        (PADDING, 62),
        f"Case: {case_key}   |   Strategy: {item.get('strategy', '?')}   |   "
        f"Composition: {scene.get('composition', '?')}   |   "
        f"Objects: {len(scene.get('objects', []))}   |   "
        f"Relationships: {len(scene.get('relationships', []))}",
        fill=(180, 200, 230),
        font=subtitle_font,
    )

    # ---------------- Panel labels ----------------
    label_font = load_font(14, bold=True)
    y_labels = HEADER_H + PADDING
    draw_panel_label(draw, PADDING, y_labels, TEXT_PANEL_W, "REQUIREMENT", label_font)
    draw_panel_label(
        draw,
        PADDING + TEXT_PANEL_W + GAP,
        y_labels,
        PANEL_SIZE,
        "VECTOR REFERENCE (SVG → PNG)",
        label_font,
    )
    draw_panel_label(
        draw,
        PADDING + TEXT_PANEL_W + GAP + PANEL_SIZE + GAP,
        y_labels,
        PANEL_SIZE,
        "FINAL OUTPUT (GPT-image edit)",
        label_font,
    )

    # ---------------- Text panel ----------------
    text_x = PADDING
    text_y = y_labels + 40
    body_font = load_font(15)
    brief_font = load_font(14)

    # Visual brief
    brief = item.get("visualBrief") or "(no visual brief)"
    draw.text((text_x, text_y), "Visual Brief:", fill=LABEL_FG, font=label_font)
    text_y += 22
    for line in wrap_text_lines(brief, brief_font, TEXT_PANEL_W - 10, draw):
        draw.text((text_x, text_y), line, fill=BODY_FG, font=brief_font)
        text_y += 20

    text_y += 14
    draw.text((text_x, text_y), "Scene Objects:", fill=LABEL_FG, font=label_font)
    text_y += 22
    for obj in scene.get("objects", []):
        name = obj.get("name", obj.get("id", "?"))
        shape = obj.get("shape", "?")
        color = obj.get("color", "?")
        line = f"• {name} ({shape}, {color})"
        draw.text((text_x, text_y), line, fill=BODY_FG, font=brief_font)
        text_y += 19

    text_y += 14
    draw.text((text_x, text_y), "Relationships:", fill=LABEL_FG, font=label_font)
    text_y += 22
    rels = scene.get("relationships", [])
    if not rels:
        draw.text((text_x, text_y), "(none)", fill=SUBTLE, font=brief_font)
    else:
        for rel in rels[:6]:
            label = rel.get("label") or rel.get("type", "?")
            frm = rel.get("from", "?")
            to = rel.get("to", "?")
            line = f"• {frm} → {to}  ({label})"
            draw.text((text_x, text_y), line, fill=BODY_FG, font=brief_font)
            text_y += 19

    # ---------------- Reference image ----------------
    ref_x = PADDING + TEXT_PANEL_W + GAP
    img_y = y_labels + 40
    ref_im = fit_image_square(ref_path, PANEL_SIZE)
    canvas.paste(ref_im, (ref_x, img_y))
    draw.rectangle(
        [ref_x - 1, img_y - 1, ref_x + PANEL_SIZE, img_y + PANEL_SIZE],
        outline=(203, 213, 225),
        width=1,
    )

    # ---------------- Final image ----------------
    final_x = ref_x + PANEL_SIZE + GAP
    final_im = fit_image_square(final_path, PANEL_SIZE)
    canvas.paste(final_im, (final_x, img_y))
    draw.rectangle(
        [final_x - 1, img_y - 1, final_x + PANEL_SIZE, img_y + PANEL_SIZE],
        outline=(203, 213, 225),
        width=1,
    )

    # ---------------- Caption: body preview ----------------
    caption_y = img_y + PANEL_SIZE + PADDING
    body = item.get("body", "")
    # Single-line body preview up to 600 chars
    preview = body.replace("\n", " ").strip()
    if len(preview) > 500:
        preview = preview[:500] + "…"
    draw.text((PADDING, caption_y), "Body Preview:", fill=LABEL_FG, font=label_font)
    caption_y += 22
    for line in wrap_text_lines(preview, body_font, W - 2 * PADDING, draw)[:4]:
        draw.text((PADDING, caption_y), line, fill=BODY_FG, font=body_font)
        caption_y += 20

    out_path = SHOWCASE_DIR / f"{case_key}_showcase.png"
    canvas.save(out_path, "PNG")
    print(f"[showcase] {case_key} → {out_path}")


def main():
    cases = sorted(
        {p.stem.split("_")[0] for p in FULL_DIR.glob("*_item.json")}
    )
    if not cases:
        print("No cases found in", FULL_DIR)
        return
    for key in cases:
        build_showcase(key)
    print(f"\nAll showcases saved to {SHOWCASE_DIR}/")


if __name__ == "__main__":
    main()
