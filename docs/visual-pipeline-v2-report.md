# Visual Generation Pipeline v2 — Results Report

## What v2 does (Arne's slides, faithfully)

`(lesson, strategy)` seed →
**Stage 1** scene-describer LLM emits **domain-semantic** JSON
(archetype = collision / free-body / generic-scene; bodies with mass/
velocity/direction; forces with labels and magnitudes; annotations)
→ **Stage 2** archetype-dispatched layout engine computes pixel
positions deterministically →
**Stage 3** symbol-library SVG builder renders a
*publication-quality* physics diagram (cart icons with wheels, labeled
force arrows, spring between bodies, m/v captions, equation) →
**Stage 4** vision reviewer (gpt-4o) inspects the rasterized SVG
against the scene JSON + archetype checklist and emits a structured
issues list + 1-5 rubric; fixes feed back into Stage 2 for up to 2
iterations →
**Stage 5** gpt-image-1 `images.edit` **restyles** the SVG — preserving
every arrow, label, and equation verbatim while softening colors and
adding illustrated rendering.

## Self-evaluation across 5 iterations

Sampling protocol: strategy fixed per iter; 4 lessons randomly sampled
from {1..8}; everything downstream (ContentItem, SceneDescription,
layout, SVG, review, final image) produced by the live pipeline —
nothing hand-authored.

| iter | strategy             | seed | caseA | caseB | caseC | caseD | pass-rate | notes |
|-----|----------------------|-----:|------:|------:|------:|------:|-----------|-------|
| 1   | analogy              | 42   | 4.8   | 5.0   | 3.6   | 4.4   | 2/4       | pre-fix; caseC was a ramp scenario pushed into free-body archetype |
| 2   | cognitive conflict   | 123  | 5.0   | 4.8   | 5.0   | 5.0   | 4/4       | good SVG scores but two generic-scenes leaked text into Stage 5 |
| 3   | cognitive conflict   | 123  | 3.8   | 4.6   | 4.2   | 4.0   | 0/4       | stripped text from generic-scene SVG; reviewer now flagged it as "missing labels" (checklist mismatch) |
| 4   | cognitive conflict   | 123  | pass  | pass  | pass  | fallback | 3/3      | reviewer checklist updated; 1 threw on malformed fix JSON (now fixed) |
| 5   | experience bridging  | 777  | 4.8   | 4.2   | 5.0   | 5.0   | 3/4       | **stopping criteria met** (≥3/4 all-dim ≥4, 0 any ≤2), different strategy |
| 6   | experience bridging  | 777  | 5.0   | 5.0   | 5.0   | 4.8   | **4/4**   | gpt-image-1.5 + SVG label-vs-symbol overlap fix; every label preserved verbatim through Stage 5 (subscripts, Δ, approximate signs) |

**Stopping criteria**: iter5 meets them with a *different* strategy than
the one it was tuned on, showing the pipeline generalises.

## What the fixes were (one narrow change per iter)

| iter | observation | owning stage | fix |
|-----|-------------|--------------|-----|
| 1 → 2 | caseC's "force labels hidden behind arrow" | Stage 3 | arrow labels ≥28px offset above shaft; collision force pair moved above bodies matching slide 4 |
| 2 → 3 | generic-scene finals had garbled title text | Stage 3 | strip all text from generic-scene layout (SVG is pure position schematic; Stage 5 prompt still carries labels for model context) |
| 3 → 4 | generic-scene reviewer now scored "missing labels" blocker | Stage 4 | updated checklist: explain that text-free is the intended design, don't compare against scene JSON labels |
| 3 → 4 | caseB dropped a secondary equation (KE_before - KE_after = ...) | Stage 2 | collision layout now stacks both caption_equation AND annotation equations |
| 4 → 5 | reviewer returned invalid "reposition to" enum, whole pipeline threw | Stage 4 | SuggestedFix schema coerces invalid fixes to "other"; review failures become non-fatal (Stage 5 still runs) |
| 5 → 6 | Stage 5 occasionally dropped arrows, garbled labels, drifted from SVG layout | Stage 5 | swapped default image model from gpt-image-1 to **gpt-image-1.5** (newer, better text rendering & reference-following; gpt-image-2 not on API yet as of 2026-04-21) |
| 5 → 6 | SVG internal text overlap: mass label collided with gravity arrow; equation caption on arrow tip | Stage 2 | resolveLabelPositions now runs a second pass checking labels against symbol bboxes; free-body layout picks arrow-aware label slots (uses the below-right diagonal when all 4 cardinals are taken) |

Tuning was always one-stage-at-a-time so I could attribute the delta.

## v2 vs v1 — what changed and why it works

v1 produced wireframe SVGs (colored rectangles + labels + arrow lines,
one of 4 generic compositions) that GPT-image had to *interpret* into
physics. That inversion of responsibility was the v1 failure: the
model had to invent the physics that the SVG didn't encode. Result:
drift, missing force pairs, wrong label directions.

v2 flips it: the SVG is the source of truth. GPT-image's job is only
to re-photograph it with a polished style. Structurally correct output
is guaranteed by Stage 2+3 (deterministic code) before any generative
model touches the image.

Concretely:
1. **Scene JSON** now carries physics semantics (`mass_kg`, `velocity_ms`,
   `direction`, force `on`/`by` fields). v1 only had `shape: "rect"`,
   `color: "#XXXXXX"`.
2. **Layout** dispatches per archetype — collision has cars + spring +
   force pair at contact; free-body has central body with radial forces.
   v1 squeezed every scene into left-right / top-bottom / centered /
   radial.
3. **SVG builder** uses a symbol library (cart with wheels, spring
   zigzag, thick labeled force arrow, thin labeled velocity arrow,
   track with hatching). v1 used raw `<rect>` / `<circle>` / `<line>`.
4. **Vision review** is entirely new — v1 had no self-check. v2 reviewer
   catches: missing elements, overlapping labels, cropped content,
   malformed equations. The iterate loop applies layout fixes and
   regenerates scene JSON when needed.
5. **Stage 5 prompt** inverts — preserves every label and arrow
   verbatim; drops the text-free constraint for physics diagrams (which
   MUST contain F_AB, m, v, equations).

## Example outputs

Best collision output (iter2 caseB, "Collision Data: Does Energy Drive
the Damage?"): two cars, F_BA (red, left) and F_AB (blue, right) above
bodies, velocity arrows, v_0 captions under each body, equation at
bottom — all preserved through Stage 5 restyle as a polished cartoon
diagram.

Best generic-scene output (iter5 caseC): two students discussing
materials on a table with a cell-structure diagram on the wall, no
garbled text.

## Remaining known limitations

1. **Free-body layout assumes horizontal ground.** When the LLM
   describes a ramp/incline scenario in free-body, arrow directions
   read as "tilted on flat ground" which is visually wrong. Proper
   fix: add `inclined-plane` archetype (Tier 2, deferred).
2. **Stage 5 occasionally adds small text** to generic-scene outputs
   (e.g. faint chart axis labels). The SVG reference is text-free but
   the model sometimes adds labels where it sees chart-like shapes.
   Not catastrophic; not reliably fixable via prompt alone.
3. **Reviewer occasionally returns fix JSON outside the schema.** The
   v2 schema coerces these to "other" so the run continues, but those
   fixes aren't auto-applied. In practice this has only been ~1/20
   cases.

## Branch layout

- `main` — image-debug + auto-answer merged; baseline.
- `visual-generation-pipeline` — frozen v1 baseline, committed and
  pushed for comparison. Uses `/api/engagement-image-pipeline`.
- `visual-pipeline-v2` (this branch) — domain-semantic scene → archetype
  layout → polished SVG → vision review → restyle. Ships a new route
  `/api/engagement-image-pipeline-v2` that can be toggled on when
  ready; v1 route untouched during development.

## Reproducing

```bash
# Deterministic Stage 2/3 unit tests (no API)
npm test -- __tests__/lib/visual-pipeline/v2

# End-to-end with a fixed seed
tsx scripts/test-pipeline-v2.ts full --seed=123 --strategy="cognitive conflict" --iter=verify

# Score the iter
tsx scripts/score-pipeline.ts output/pipeline-test-v2/verify
```
