#!/usr/bin/env python3
"""
Render output/analogy-prompts-for-review.md into a clean PDF.

Deliberately hand-rolled (no pandoc/weasyprint available) so the output
stays tight: cover page, section headings, one table, code blocks on a
shaded background, and a flow diagram in monospace.
"""

from __future__ import annotations

import re
from pathlib import Path
from fpdf import FPDF

SRC = Path("output/analogy-prompts-for-review.md")
DST = Path("output/analogy-prompts-for-review.pdf")

# -- fonts --------------------------------------------------------------------
FONT_REG = "/Library/Fonts/Arial Unicode.ttf"
FONT_REG_FALLBACK = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_ITAL = "/System/Library/Fonts/Supplemental/Arial Italic.ttf"
FONT_MONO = "/System/Library/Fonts/Supplemental/Courier New.ttf"
FONT_MONO_BOLD = "/System/Library/Fonts/Supplemental/Courier New Bold.ttf"

# -- page / color -------------------------------------------------------------
PAGE_W, PAGE_H = 210, 297        # A4 in mm
MARGIN_L, MARGIN_R, MARGIN_T, MARGIN_B = 20, 20, 22, 22
CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R

INK = (30, 41, 59)               # body
INK_SOFT = (71, 85, 105)
ACCENT = (30, 64, 175)           # dark blue for H1
HEADING = (15, 23, 42)
RULE = (203, 213, 225)
CODE_BG = (245, 247, 250)
CODE_BORDER = (226, 232, 240)
CODE_FG = (30, 41, 59)
TABLE_HEAD_BG = (30, 41, 59)
TABLE_HEAD_FG = (248, 250, 252)
TABLE_ZEBRA = (248, 250, 252)


class PDF(FPDF):
    def header(self):
        # Cover page has no header
        if self.page_no() == 1:
            return
        self.set_font("arial", "", 8.5)
        self.set_text_color(*INK_SOFT)
        self.set_y(10)
        self.set_x(MARGIN_L)
        self.cell(CONTENT_W - 30, 5, "Analogy Material — Prompts for Expert Review", align="L")
        self.cell(30, 5, f"Page {self.page_no() - 1}", align="R")
        self.set_draw_color(*RULE)
        self.set_line_width(0.2)
        self.line(MARGIN_L, 17, PAGE_W - MARGIN_R, 17)
        self.set_y(MARGIN_T)
        self.set_x(MARGIN_L)

    def footer(self):
        pass


def load_fonts(pdf: PDF) -> None:
    reg = FONT_REG if Path(FONT_REG).exists() else FONT_REG_FALLBACK
    pdf.add_font("arial", "", reg)
    pdf.add_font("arial", "B", FONT_BOLD)
    pdf.add_font("arial", "I", FONT_ITAL)
    pdf.add_font("mono", "", FONT_MONO)
    pdf.add_font("mono", "B", FONT_MONO_BOLD)


# -- rendering primitives -----------------------------------------------------

def set_body(pdf: PDF, size: float = 10.5) -> None:
    pdf.set_font("arial", "", size)
    pdf.set_text_color(*INK)


def hr(pdf: PDF, gap_before: float = 3, gap_after: float = 3) -> None:
    pdf.ln(gap_before)
    pdf.set_draw_color(*RULE)
    pdf.set_line_width(0.3)
    y = pdf.get_y()
    pdf.line(MARGIN_L, y, PAGE_W - MARGIN_R, y)
    pdf.ln(gap_after)


def ensure_space(pdf: PDF, needed: float) -> None:
    if pdf.get_y() + needed > PAGE_H - MARGIN_B:
        pdf.add_page()


INLINE_CODE_RE = re.compile(r"`([^`]+)`")


def render_inline(pdf: PDF, text: str, size: float = 10.5, line_h: float = 5.6) -> None:
    """Paragraph with inline **bold** runs (via multi_cell markdown mode)."""
    text = INLINE_CODE_RE.sub(r"\1", text)
    pdf.set_font("arial", "", size)
    pdf.set_text_color(*INK)
    pdf.set_x(MARGIN_L)
    pdf.multi_cell(CONTENT_W, line_h, text, markdown=True, align="L", new_x="LMARGIN", new_y="NEXT")


def h1(pdf: PDF, text: str) -> None:
    ensure_space(pdf, 20)
    pdf.ln(2)
    pdf.set_font("arial", "B", 20)
    pdf.set_text_color(*ACCENT)
    pdf.set_x(MARGIN_L)
    pdf.multi_cell(CONTENT_W, 9, text)
    pdf.ln(1.5)


def h2(pdf: PDF, text: str) -> None:
    ensure_space(pdf, 16)
    pdf.ln(4)
    pdf.set_font("arial", "B", 14.5)
    pdf.set_text_color(*HEADING)
    pdf.set_x(MARGIN_L)
    pdf.multi_cell(CONTENT_W, 7, text)
    # thin accent underline
    y = pdf.get_y() + 0.3
    pdf.set_draw_color(*ACCENT)
    pdf.set_line_width(0.5)
    pdf.line(MARGIN_L, y, MARGIN_L + 20, y)
    pdf.ln(3)


def h3(pdf: PDF, text: str) -> None:
    ensure_space(pdf, 12)
    pdf.ln(2)
    pdf.set_font("arial", "B", 11.5)
    pdf.set_text_color(*HEADING)
    pdf.set_x(MARGIN_L)
    pdf.multi_cell(CONTENT_W, 6, text)
    pdf.ln(1)


def paragraph(pdf: PDF, text: str) -> None:
    ensure_space(pdf, 8)
    pdf.set_x(MARGIN_L)
    render_inline(pdf, text)
    pdf.ln(1.2)


def bullet(pdf: PDF, text: str) -> None:
    ensure_space(pdf, 7)
    pdf.set_font("arial", "", 10.5)
    pdf.set_text_color(*INK)
    pdf.set_x(MARGIN_L + 2)
    pdf.cell(4, 5.6, "•")
    pdf.set_x(MARGIN_L + 6)
    # Inline-render remainder within indented margin
    saved_margin = MARGIN_L
    # temporary: shrink by tracking x manually in render_inline via x_left
    # Simpler: manually wrap here using multi_cell with pseudo indent
    pdf.multi_cell(CONTENT_W - 6, 5.6, strip_inline_markup(text))
    pdf.ln(0.3)


def strip_inline_markup(text: str) -> str:
    """For bullet / table cells we render as plain (keeps layout simple)."""
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = INLINE_CODE_RE.sub(r"\1", text)
    return text


def code_block(pdf: PDF, lines: list[str]) -> None:
    pdf.set_font("mono", "", 8.8)
    pdf.set_text_color(*CODE_FG)
    line_h = 4.1
    pad_x = 3.2
    pad_y = 2.6

    # wrap each logical line to fit column width
    inner_w = CONTENT_W - 2 * pad_x
    wrapped: list[str] = []
    max_chars = 0
    # Approximate char count that fits
    sample_w = pdf.get_string_width("M")
    max_chars = max(10, int(inner_w / sample_w))
    for ln in lines:
        if ln == "":
            wrapped.append("")
            continue
        # hard-wrap long lines on whitespace boundaries
        remaining = ln
        while pdf.get_string_width(remaining) > inner_w:
            # find last breakpoint before inner_w
            lo, hi = 0, len(remaining)
            while lo < hi:
                mid = (lo + hi) // 2
                if pdf.get_string_width(remaining[:mid]) <= inner_w:
                    lo = mid + 1
                else:
                    hi = mid
            cut = lo - 1
            if cut <= 0:
                cut = len(remaining)
            # try to break at a space
            space = remaining.rfind(" ", 0, cut)
            if space > 20:
                cut = space
            wrapped.append(remaining[:cut].rstrip())
            remaining = remaining[cut:].lstrip() if remaining[cut:cut + 1] == " " else remaining[cut:]
        wrapped.append(remaining)

    # draw a background rectangle sized to wrapped lines (paginate as needed)
    i = 0
    while i < len(wrapped):
        # Compute how many lines fit on current page
        available = PAGE_H - MARGIN_B - pdf.get_y() - 2
        lines_fit = max(1, int((available - 2 * pad_y) // line_h))
        chunk = wrapped[i : i + lines_fit]
        box_h = 2 * pad_y + line_h * len(chunk)
        x0 = MARGIN_L
        y0 = pdf.get_y()
        pdf.set_fill_color(*CODE_BG)
        pdf.set_draw_color(*CODE_BORDER)
        pdf.set_line_width(0.2)
        pdf.rect(x0, y0, CONTENT_W, box_h, style="FD")
        y = y0 + pad_y
        for ln in chunk:
            pdf.set_xy(x0 + pad_x, y)
            if ln:
                pdf.cell(inner_w, line_h, ln)
            y += line_h
        pdf.set_y(y0 + box_h)
        pdf.ln(1.5)
        i += lines_fit
        if i < len(wrapped):
            pdf.add_page()
            pdf.set_font("mono", "", 8.8)
            pdf.set_text_color(*CODE_FG)


def render_table(pdf: PDF, header: list[str], rows: list[list[str]], col_ratios: list[float]) -> None:
    ensure_space(pdf, 30)
    widths = [CONTENT_W * r for r in col_ratios]
    pdf.set_font("arial", "B", 10)
    pdf.set_text_color(*TABLE_HEAD_FG)
    pdf.set_fill_color(*TABLE_HEAD_BG)
    pdf.set_x(MARGIN_L)
    for w, cell in zip(widths, header):
        pdf.cell(w, 7.5, cell, fill=True, align="L", border=0)
    pdf.ln(7.5)

    pdf.set_font("arial", "", 9.5)
    pdf.set_text_color(*INK)
    for row_i, row in enumerate(rows):
        # Measure tallest wrapped cell
        cell_lines_per_col: list[list[str]] = []
        for w, cell in zip(widths, row):
            lines = wrap_to_width(pdf, cell, w - 3)
            cell_lines_per_col.append(lines)
        row_lines = max(len(lines) for lines in cell_lines_per_col)
        row_h = row_lines * 5.2 + 2

        ensure_space(pdf, row_h + 2)
        x0 = MARGIN_L
        y0 = pdf.get_y()
        if row_i % 2 == 1:
            pdf.set_fill_color(*TABLE_ZEBRA)
            pdf.rect(x0, y0, CONTENT_W, row_h, style="F")

        x = x0
        for w, lines in zip(widths, cell_lines_per_col):
            ty = y0 + 1.5
            for ln in lines:
                pdf.set_xy(x + 1.5, ty)
                pdf.cell(w - 3, 5.2, ln)
                ty += 5.2
            x += w

        pdf.set_draw_color(*RULE)
        pdf.set_line_width(0.15)
        pdf.line(x0, y0 + row_h, x0 + CONTENT_W, y0 + row_h)
        pdf.set_y(y0 + row_h)
    pdf.ln(2)


def wrap_to_width(pdf: PDF, text: str, width: float) -> list[str]:
    text = strip_inline_markup(text)
    words = text.split()
    lines: list[str] = []
    cur = ""
    for w in words:
        trial = (cur + " " + w).strip()
        if pdf.get_string_width(trial) <= width:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines if lines else [""]


# -- cover --------------------------------------------------------------------

def build_cover(pdf: PDF) -> None:
    pdf.add_page()
    # Top accent bar
    pdf.set_fill_color(*ACCENT)
    pdf.rect(0, 0, PAGE_W, 4, style="F")

    pdf.set_y(80)
    pdf.set_font("arial", "B", 26)
    pdf.set_text_color(*HEADING)
    pdf.set_x(MARGIN_L)
    pdf.multi_cell(CONTENT_W, 12, "Analogy Material")
    pdf.set_font("arial", "B", 16)
    pdf.set_text_color(*ACCENT)
    pdf.set_x(MARGIN_L)
    pdf.multi_cell(CONTENT_W, 9, "Prompts for Expert Review")
    pdf.ln(4)

    # Subtitle / summary line
    pdf.set_font("arial", "", 11)
    pdf.set_text_color(*INK_SOFT)
    pdf.set_x(MARGIN_L)
    pdf.multi_cell(
        CONTENT_W,
        6.2,
        "The complete set of prompts used by the system to generate student-facing "
        "analogy material. Two LLM calls run in sequence: one to write the passage, "
        "one to draw the illustration.",
    )

    # Divider
    pdf.ln(14)
    pdf.set_draw_color(*ACCENT)
    pdf.set_line_width(0.7)
    pdf.line(MARGIN_L, pdf.get_y(), MARGIN_L + 40, pdf.get_y())
    pdf.ln(6)

    # Contents
    pdf.set_font("arial", "B", 11)
    pdf.set_text_color(*HEADING)
    pdf.set_x(MARGIN_L)
    pdf.cell(0, 6, "Contents")
    pdf.ln(7)
    pdf.set_font("arial", "", 10.5)
    pdf.set_text_color(*INK)
    for line in [
        "1.  What prompts exist",
        "2.  End-to-end flow",
        "3.  The prompts themselves",
        "     3a. System message",
        "     3b. User message",
        "     3c. Bridging-analogy guide  (primary focus for review)",
        "     3d. Image prompt",
    ]:
        pdf.set_x(MARGIN_L)
        pdf.cell(0, 5.6, line)
        pdf.ln(5.6)


# -- main script --------------------------------------------------------------

def build() -> None:
    pdf = PDF(orientation="P", unit="mm", format="A4")
    pdf.set_margins(MARGIN_L, MARGIN_T, MARGIN_R)
    pdf.set_auto_page_break(auto=False)
    load_fonts(pdf)

    build_cover(pdf)

    # Body content (content-authored rather than parsed, so layout stays clean).
    pdf.add_page()

    # Intro paragraph
    set_body(pdf)
    paragraph(
        pdf,
        "When a teacher picks a lesson and chooses the **Analogy** strategy, the "
        "system runs **two** LLM calls, one after the other, to produce what the "
        "student sees.",
    )

    # Section 1 — table
    h2(pdf, "1.  What prompts exist")
    render_table(
        pdf,
        header=["#", "Prompt", "What it does", "Input", "Output"],
        rows=[
            [
                "1",
                "Content prompt",
                "Writes the passage the student will read, following the bridging-analogy structure.",
                "Lesson title, learning objective, strategy name and description.",
                "A short JSON object: title, body (the passage), and visualBrief (one sentence describing the illustration).",
            ],
            [
                "2",
                "Image prompt",
                "Draws the single illustration that appears next to the passage.",
                "Everything Prompt 1 produced, plus the lesson and strategy info.",
                "One PNG/WEBP image, 1024×1024.",
            ],
        ],
        col_ratios=[0.05, 0.17, 0.30, 0.24, 0.24],
    )
    paragraph(
        pdf,
        "That is the whole pipeline for analogy material. No other prompts are involved.",
    )

    # Section 2 — flow diagram
    h2(pdf, "2.  End-to-end flow")
    code_block(
        pdf,
        [
            "(teacher picks lesson + \"Analogy\")",
            "          |",
            "          v",
            "+-----------------------------+",
            "|  Prompt 1 -- Content prompt |   model: gpt-5-nano",
            "|  writes the 5-step passage  |",
            "+-----------------------------+",
            "          |  passage text + one-sentence visualBrief",
            "          v",
            "+-----------------------------+",
            "|  Prompt 2 -- Image prompt   |   model: gpt-image-1",
            "|  draws one illustration     |",
            "+-----------------------------+",
            "          |",
            "          v",
            "    student sees:  [ passage ]  +  [ one image ]",
        ],
    )
    paragraph(
        pdf,
        "The **pedagogical content** lives entirely in Prompt 1. Prompt 2 just turns "
        "the resulting scene description into a picture.",
    )

    # Section 3 — the prompts themselves
    h2(pdf, "3.  The prompts themselves")
    paragraph(
        pdf,
        "Prompt 1 is made of three parts, sent together in one call:",
    )
    bullet(pdf, "(3a) System message — generic framing, same for every strategy.")
    bullet(pdf, "(3b) User message — the request, with lesson and strategy details filled in.")
    bullet(
        pdf,
        "(3c) Bridging-analogy guide — the pedagogy. This block is only attached when the strategy is Analogy.",
    )
    paragraph(
        pdf,
        "All three are concatenated in the order (3a) → (3b) → (3c) and sent to the model.",
    )

    # 3a
    h3(pdf, "3a.  System message")
    code_block(
        pdf,
        [
            "You are an education content designer creating short, student-facing science materials.",
            "Return JSON only with key: items (array).",
            "Return exactly 1 item in the array.",
            "Each item must include:",
            "- type: a short label such as \"Questions\", \"Phenomenon\", \"Dialogue\", or a short combination label",
            "- title: a concise, student-facing title",
            "- body: the exact text students will read directly",
            "- textModes: an array using only \"questions\", \"phenomenon\", and/or \"dialogue\"",
            "- visualBrief: one short sentence describing what the illustration should show",
            "Do not include teacher directions, facilitation notes, or implementation instructions.",
        ],
    )

    # 3b
    h3(pdf, "3b.  User message")
    paragraph(
        pdf,
        "Placeholders in `{{ ... }}` are filled from the lesson data at the moment the prompt is built.",
    )
    code_block(
        pdf,
        [
            "Lesson:",
            "- Title: {{lessonTitle}}",
            "- Learning objective: {{learningObjective}}",
            "",
            "Engagement strategy:",
            "- Name: Analogy",
            "- Description: Explains a new idea by comparing it to something students already know well.",
            "",
            "Create exactly 1 student-facing content item aligned to the lesson objective and strategy.",
            "The text can use one or a combination of:",
            "(a) questions,",
            "(b) a short description of a phenomenon, or",
            "(c) a dialogue between two virtual students or between a teacher and a student.",
            "",
            "Requirements:",
            "- This will be shared directly with students, so write to students instead of to teachers.",
            "- Make the objective visible in the thinking students are asked to do; do not drift into a generic physics scene.",
            "- Avoid phrases such as \"ask students\", \"have students\", \"teacher note\", or lesson-delivery instructions.",
            "- Keep it concrete, vivid, and age-appropriate for middle-school physics learners.",
            "- The image must clearly reflect the scene or interaction described in the text.",
            "- Keep the body concise, around 300-500 words, with line breaks if helpful.",
            "- Do not mention the engagement strategy by name to students.",
            "",
            "Return exactly 1 item in items.",
        ],
    )
    paragraph(pdf, "For Lesson 6 (Newton's Third Law), the filled-in values would be:")
    bullet(pdf, "lessonTitle = \"Lesson 6\"")
    bullet(
        pdf,
        "learningObjective = \"Students will model real-world collisions to demonstrate Newton's "
        "Third Law, synthesizing kinematic data to argue which specific scenarios generate peak "
        "forces that exceed the elastic limits of biological tissues.\"",
    )

    # 3c
    h3(pdf, "3c.  Bridging-analogy guide — the pedagogy")
    paragraph(
        pdf,
        "**This is the block the expert should focus on.** It is the only part of the prompt "
        "that encodes Clement's 1993 bridging-analogy method.",
    )
    code_block(
        pdf,
        [
            "ANALOGY GENERATION GUIDE (Clement 1993, \"Bridging Analogies\"):",
            "",
            "Why simple analogy fails: When students are told \"X is like Y\", they often reject it",
            "(\"a table is not at all like a spring -- a table is rigid and dead, whereas a spring",
            "returns to its original position\"). To overcome this, use a bridging sequence with",
            "intermediate cases that divide the analogy into smaller, easier-to-comprehend pieces.",
            "",
            "Required 5-step structure for the body (label each step clearly):",
            "1. ANCHOR -- A familiar situation students intuitively accept and already understand.",
            "2. BRIDGE -- An intermediate case sharing features with both the anchor and the target.",
            "   This is the conceptual bridge that connects what students know to what we want them",
            "   to understand.",
            "3. TARGET -- The actual physics situation tied to the lesson objective.",
            "4. MICROSCOPIC MODEL -- A deeper conceptual model explaining WHY the analogy holds at",
            "   the underlying level.",
            "5. EMPIRICAL CONNECTION -- A real-world observation, demonstration, or experiment",
            "   students could try to test the idea.",
            "",
            "Few-shot example (Newton's Third Law, target misconception: \"the moving cart exerts",
            "a larger force on the stationary one\"):",
            "",
            "  ANCHOR: When you press your hands together with a spring squeezed between them,",
            "  both hands feel the same push from the spring -- left and right are equal partners.",
            "",
            "  BRIDGE: Now picture two carts on a track, one rolling toward another, with a",
            "  spring-loaded plunger between them. When they meet, the spring squeezes both carts",
            "  with the same force, no matter which cart was moving.",
            "",
            "  TARGET: Replace the spring-loaded carts with two ordinary, rigid carts colliding",
            "  head-on. Even without a visible spring, the moving cart and the stationary cart push",
            "  on each other with exactly the same force during the collision.",
            "",
            "  MICROSCOPIC MODEL: Why? Zoom in to the surfaces where the carts touch. The atoms",
            "  there are held together by bonds that act like tiny springs. When the carts press,",
            "  those microscopic springs compress and push back equally on both sides -- just like",
            "  the visible spring did.",
            "",
            "  EMPIRICAL CONNECTION: Try this: two students ride on rolling carts holding bathroom",
            "  scales out in front. When they collide, both scales show the same reading, even if",
            "  one student was sitting still and the other was rolling toward them.",
            "",
            "VisualBrief instruction: Focus the illustration on the BRIDGE step (the intermediate",
            "example) -- that is where the conceptual bridge is most visible and memorable. For",
            "example: \"Two momentum carts colliding on a track with a spring-loaded plunger between",
            "them, equal-length force arrows pointing into each cart from the spring.\"",
            "",
            "Format the body with the 5 step labels visible (ANCHOR / BRIDGE / TARGET / MICROSCOPIC",
            "MODEL / EMPIRICAL CONNECTION) so the structure is clear to the student. Adapt the",
            "content to the lesson's actual topic -- do NOT just reuse the Newton's Third Law example.",
        ],
    )

    # 3d — image prompt
    h3(pdf, "3d.  Image prompt (Prompt 2)")
    paragraph(
        pdf,
        "A single block of text (no separate system / user split). Placeholders are filled from "
        "Prompt 1's output and the lesson info.",
    )
    code_block(
        pdf,
        [
            "Create a simple, student-friendly illustration for a 8th grade lesson.",
            "This image will be shown directly to students next to the material below.",
            "Lesson: {{lessonTitle}}",
            "Learning objective: {{learningObjective}}",
            "Strategy: Analogy - Explains a new idea by comparing it to something students already know well.",
            "Text style: {{textModes}}",
            "Title: {{title from Prompt 1}}",
            "Student-facing text:",
            "{{body from Prompt 1}}",
            "Visual brief: {{visualBrief from Prompt 1}}",
            "",
            "Ensure the image supports the lesson objective through the scene students will analyze.",
            "If the material includes dialogue, clearly show the speakers and what they are reacting to.",
            "If the material includes questions, show the scene students should reason about.",
            "If the material describes a phenomenon, make that phenomenon visually central.",
            "Style: clean, minimal, classroom-friendly.",
            "Hard requirement: the image must contain zero text of any kind.",
            "Do not render words, letters, numbers, equations, symbols, speech bubbles with text, captions, labels, posters, signs, UI text, or watermarks.",
        ],
    )
    paragraph(
        pdf,
        "The image prompt carries no pedagogical instruction beyond re-stating the lesson "
        "objective. Its main job is to stay faithful to the passage and produce a clean, "
        "text-free illustration.",
    )

    pdf.output(str(DST))
    print(f"Wrote {DST}")


if __name__ == "__main__":
    build()
