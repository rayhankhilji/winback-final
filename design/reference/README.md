# Design reference — not shipped

Source material the ingestion animation was built from. **Nothing in this
folder is imported by `src/`, bundled, or served.** It is here so the next
person can see what the motion was modelled on.

## `integration-orbit.lottie` / `integration-orbit.svg`

A LottieFiles animation supplied as the reference for the processing state:
logos orbiting a centre point along connecting lines.

Two reasons the shipped component is a rebuild rather than this file:

1. **It is another company's branding.** The centre layer is literally named
   `flokzu logo Outlines`, and the orbiting marks are third-party product
   logos. Shipping it would put someone else's trademarks in our product.
2. **It cannot follow the design system.** A Lottie is baked hex — `#666666`
   here — and `CLAUDE.md` requires colour to come from `DESIGN.md` tokens with
   zero hardcoded hex in components. It also cannot respond to
   `prefers-reduced-motion`, which `DESIGN.md` requires of everything, and the
   runtime to play it is ~250KB for one screen.

What was kept: the *idea* — discrete sources converging on one centre along
visible connectors — which is exactly what ingestion does.
