# Design System — Winback

> The visual language. Every UI decision references these tokens. No ad-hoc values in components.
> **Owns:** colour, type, spacing, radii, elevation, component rules, motion, required states.
> **Never contains:** product logic (→ `PRD.md`), stack (→ `ARCHITECTURE.md`).

## Direction

Modern, calm, precise. A dense product surface that stays quiet: near-white warm canvas, white cards
lifting off it on soft shadows, one grotesk at many sizes, hairline warm borders, and colour used
only where it carries meaning. The feel is a frontier tooling product — Linear, Vercel, Attio — with
a warmer neutral base and one unmistakable signature colour.

**It is not:** editorial or print-styled. No sand-coloured paper ground, no full-bleed brown bands,
no alternating warm/dark section rhythm, no sharp 0px corners, no "well-set research note". That
direction was considered and rejected — it reads as a publication, not software, and this is an
agentic workflow platform.

**It is not:** gradient-heavy, glassmorphic, glowing, dark-mode-first, or illustrated.

**The one big idea, kept:** *pink means AI.* Every pink pixel in the product marks something a model
generated or extracted. Nothing else is ever pink. Users learn in about thirty seconds that pink =
machine-derived, and from then on they can scan a screen and instantly separate what the AI produced
from what a human entered. In a product sold to buyers sceptical of AI, that legibility is the
feature. Do not spend pink on decoration; it dilutes the signal.

Light mode only. Dark mode is out of scope.

## Colour

### Surfaces

| Token | Value | Use |
|---|---|---|
| `--surface-canvas` | `#F6F5F1` | App background. Warm off-white, not grey, not beige. |
| `--surface-card` | `#FFFFFF` | Cards, panels, modals, drawer, table bodies |
| `--surface-sunken` | `#F2F0E9` | Sidebar, table headers, wells, inset panels |
| `--surface-deep` | `#ECE9DF` | Code blocks, deeply inset regions. Rare. |

### Text and borders

| Token | Value | Contrast on canvas | Use |
|---|---|---|---|
| `--text-primary` | `#383838` | 10.75 | All body text, headings, figures |
| `--text-secondary` | `#6E6E6C` | 4.68 | Labels, captions, metadata |
| `--text-disabled` | `#A0A09E` | 2.40 | Disabled only. Never for real content. |
| `--text-display` | `#1F1E1C` | 12.4 | Large headings and hero figures. Warm near-black. |
| `--border` | `#E2D8CC` | — | Hairlines, dividers, input borders, table rules |
| `--border-strong` | `#CEBAA7` | — | Hover borders, active row, focused card |

`#CEBAA7` is a surface colour. **Never use it for text at any size.**

### Semantic accents

Each colour means exactly one thing. Never decorative, never doubled up.

| Meaning | Fill | Wash | Text-safe variant | Applies to |
|---|---|---|---|---|
| **AI / generated** | `#F27DB4` | `#F7ACCF` / `#F4E1EA` | *none — see below* | Extraction highlights, citation markers, generated content, AI badges |
| **Interactive** | `#5E9FD4` | `#E4EBF1` | `#2A6FA6` (4.91) | Links, focus rings, active nav, selected rows |
| **Validated / positive** | `#86B455` | `#EBEFE6` | `#517031` (5.19) | Confirmed extraction, positive deltas, completed jobs |
| **Needs review** | — | `#F0ECE5` | `#8C6A2F` (4.56) | Low-confidence extraction, stale data |
| **Failed** | — | `#F2E6E4` | `#B3402A` (5.23) | Parse failure, validation errors, expired links |

### Two hard colour rules

**1. No white text on any accent fill.** White on `#F27DB4` is 2.51:1 and on `#5E9FD4` is 2.84:1 —
both fail badly. Every accent surface takes a `--text-primary` label. This is why the primary button
is pink with dark text rather than the other way round, and it looks better anyway.

**2. Pink is never text on a light ground.** Darkening it enough to pass AA produces a hot magenta
that stops reading as the brand. On light surfaces pink is a fill, a highlight, a marker, an
underline, a dot. Pink content takes a `--text-primary` label next to a pink marker. On the dark
surface `#1F1E1C`, pink is excellent type (6.64:1) — that is the one place to use it as text.

## Typography

**Inter Variable, everything.** Loaded via `next/font/google`, weights 400/500/600, `display: swap`.
One family at many sizes is what makes this look designed rather than assembled. Numbers use
`font-variant-numeric: tabular-nums` everywhere without exception — misaligned figures are the
fastest way to look amateur in a finance product.

Scale: 1.25 ratio, 16px base.

| Token | Size / line-height | Tracking | Weight | Use |
|---|---|---|---|---|
| `--text-xs` | 12 / 16 | 0.01em | 500 | Chips, badges, table metadata, timestamps |
| `--text-sm` | 13 / 20 | 0 | 400–500 | Table cells, labels, secondary body |
| `--text-base` | 15 / 24 | 0 | 400 | Body, inputs, memo text |
| `--text-lg` | 18 / 26 | -0.011em | 600 | Card and panel titles |
| `--text-xl` | 22 / 30 | -0.017em | 600 | Screen headings |
| `--text-2xl` | 28 / 34 | -0.021em | 600 | Page titles |
| `--text-3xl` | 40 / 44 | -0.026em | 600 | Hero figures, big metric numbers |

Never weight 700. Size carries hierarchy, weight carries importance, colour carries meaning — never
mix those jobs.

## Spacing and layout

4px base. Scale `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96`. Nothing off-scale, ever.

- Desktop only, 1280–1600px target, must not break at 1024px.
- Sidebar 240px fixed, `--surface-sunken`, hairline right border.
- Content max-width 1360px, 32px gutters.
- Header 60px. Drawer 560px, right-anchored.
- Card padding 24px. Section gap 32px. Related-element gap 12px.
- **Whitespace is the primary tool.** If a screen feels flat, add space and fix the type — do not
  add colour or another border.

## Radii and elevation

Soft, not round, not sharp.

```
--radius-sm:  6px    chips, badges, inputs, small buttons
--radius:    10px    cards, buttons, panels
--radius-lg: 14px    drawer, modal, popover
```

Borders are `1px solid var(--border)`. Shadows are layered and barely visible — they create
separation, never drama.

```
--shadow-card:    0 1px 2px rgba(31,30,28,.04), 0 1px 3px rgba(31,30,28,.03);
--shadow-raised:  0 2px 4px rgba(31,30,28,.04), 0 4px 12px rgba(31,30,28,.05);
--shadow-overlay: 0 8px 16px rgba(31,30,28,.06), 0 24px 48px rgba(31,30,28,.10);
```

Cards get `--shadow-card` **or** a border, not both. Pick per surface and stay consistent: on
`--surface-canvas`, white cards use the shadow; inside a card, nested regions use a border.

## Components

**Buttons.** 36px height (40px for primary page actions), 14px horizontal padding, `--radius`,
weight 500, `--text-sm`.
- `primary` — `#F27DB4` fill, `--text-primary` label. Hover darkens 6%.
- `dark` — `#1F1E1C` fill, white label. For maximum-emphasis single actions.
- `secondary` — `--surface-card` fill, `--border` outline, `--text-primary`.
- `ghost` — transparent, `--text-secondary`, hover fills `--surface-sunken`.
- Loading keeps its label and adds an inline spinner. Never collapse the width.

**Inputs.** 36px, `--surface-card`, `--border`, `--radius-sm`. Focus is a 2px `#5E9FD4` ring at 2px
offset — never a colour-only change. Error state gets a `#B3402A` border and a 13px message below.

**Cards.** `--surface-card`, `--radius`, 24px padding, `--shadow-card`. Title `--text-lg`, 16px gap
to content.

**Tables.** Header row `--surface-sunken`, `--text-xs` uppercase `--text-secondary`, `--border`
bottom. Rows separated by `--border`. Hover `--surface-canvas`. Numerics right-aligned, tabular.
Deltas show an arrow glyph plus colour, never colour alone.

**Metric cards.** Label `--text-xs` `--text-secondary` uppercase; value `--text-3xl` `--text-display`
tabular; delta below with arrow and semantic colour. This is the dashboard's main unit — get it right
once and reuse it.

**Evidence chip.** The signature component and the product's whole argument in one element.
`--radius-sm`, `#F4E1EA` fill, 1px `#F7ACCF` border, `--text-primary` label at `--text-xs`, a 12px
document glyph before it, 2px 8px padding. Hover raises the border to `#F27DB4`. It is a `<button>`
with a visible focus ring. Never a bare coloured `<span>`.

**Extraction highlight.** In the document viewer, the cited passage gets a `#F7ACCF` background —
literally a highlighter mark on the page — and a 2px `#F27DB4` left rule, scrolled into view with
80px of headroom. This is the single most important visual moment in the product. Budget your polish
here.

**AI badge.** Any generated content block carries a small `#F4E1EA` chip reading "Generated" or
"Extracted". Consistency matters more than subtlety.

**Stage stepper.** Four stages, dot plus label. Idle `--border-strong` outline; active `#5E9FD4`
filled with a pulsing ring; done `#86B455` filled with a check; failed `#B3402A` filled with an
exclamation. The connecting rule fills as stages complete.

**Focus.** Every interactive element: `outline: 2px solid #5E9FD4; outline-offset: 2px` on
`:focus-visible`. Never `outline: none` without a replacement.

## Data visualisation

Series order: `#5E9FD4` → `#F27DB4` → `#86B455` → `#6F4E37` → `#8EBCE1` → `#A4C77F`.
Blue leads because it is the most neutral. **Never encode meaning by hue alone** — pair with a label,
shape, or pattern. Gridlines `--border` at 50%. Axis labels `--text-xs` `--text-secondary`. No
chart junk, no 3D, no drop shadows on series.

## Motion

150ms for hover, focus and colour; 220ms for drawer, panel and route transitions.
Easing `cubic-bezier(0.2, 0, 0, 1)`. The drawer slides from the right and fades a scrim at 30%
`#1F1E1C`. Long waits use a determinate stepper plus skeletons, never an indefinite spinner.
Nothing animates decoratively. Everything respects `prefers-reduced-motion: reduce`.

## Required UI states

Every data view designs all four.

- **Loading** — skeletons shaped like the final layout. Multi-second work shows the stepper and
  elapsed seconds so a 40-second wait reads as working, not broken.
- **Empty** — designed, never blank. One line of explanation and the action that fills it.
- **Error** — calm inline message in `#B3402A` with a Retry that re-dispatches. Human language, never
  a stack trace. A 429 reads "Rate limit reached — please wait a moment" plus retry-after seconds.
- **Populated** — the default.

## Tailwind v4 tokens

```css
@theme inline {
  --color-canvas:       #F6F5F1;
  --color-card:         #FFFFFF;
  --color-sunken:       #F2F0E9;
  --color-deep:         #ECE9DF;

  --color-text:         #383838;
  --color-text-muted:   #6E6E6C;
  --color-text-disabled:#A0A09E;
  --color-text-display: #1F1E1C;
  --color-border:       #E2D8CC;
  --color-border-strong:#CEBAA7;

  --color-ai:           #F27DB4;
  --color-ai-wash:      #F7ACCF;
  --color-ai-tint:      #F4E1EA;

  --color-interactive:  #5E9FD4;
  --color-interactive-fg:#2A6FA6;
  --color-interactive-tint:#E4EBF1;

  --color-success:      #86B455;
  --color-success-fg:   #517031;
  --color-success-tint: #EBEFE6;

  --color-warning-fg:   #8C6A2F;
  --color-warning-tint: #F0ECE5;

  --color-danger-fg:    #B3402A;
  --color-danger-tint:  #F2E6E4;

  --radius-sm: 6px;
  --radius:   10px;
  --radius-lg:14px;
}
```

## Quality bar

If a screen would look out of place in a well-designed, venture-backed product, it is not done.
Consistency across every screen beats novelty on one. When in doubt: more whitespace, fewer borders,
less colour, better type.
