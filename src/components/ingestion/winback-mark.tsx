// ============================================================================
// src/components/ingestion/winback-mark.tsx — the Winback mark.
//
// Three isometric cubes packed around an empty fourth cell, drawn as pure
// geometry rather than traced from the source image: every vertex below is
// computed from one cube edge length, so the mark stays crisp at any size and
// the three cubes tile exactly — the lower cube's upper edges ARE the upper
// cubes' lower edges, no seams and no overlap.
//
// Monochrome and `currentColor` by design. It sits on a light card and
// DESIGN.md forbids white text or marks on any accent fill, so the parent
// sets the colour and this never picks one.
//
// Geometry: true isometric projection — half-width w = h·√3, vertical edge
// d = 2h, taken from the brand animation's own path data (a face rhombus of
// ±34.641 × ±20, and 34.641 = 20√3). Two cubes sit side by side on the upper
// level; the third sits one level DOWN in the column behind their junction.
//
// That third position is the whole trick. Placed there, the lower cube's two
// upper vertices land exactly on the upper cubes' lower vertices, so the three
// tile edge to edge with no overlap and no hidden lines — which is why the
// mark needs no fill and works on any background. Move it one step and the
// cubes intersect, every occluded edge shows through, and it reads as a blob.
//
// The figure is 42 × 42.44 units, fitted to a 48×48 box.
// ============================================================================

export interface WinbackMarkProps {
  /** Rendered size in px. */
  size?: number;
  /** Stroke weight in viewBox units. 2.4 matches the brand mark's weight. */
  strokeWidth?: number;
  className?: string;
  /** Give the mark an accessible name when it stands alone as the logo. */
  title?: string;
}

/** One cube, as its hexagonal silhouette plus the three interior edges that
 *  make it read as a solid rather than a hexagon. */
function cube(tx: number, ty: number, w: number, hh: number, d: number) {
  const p1 = [tx, ty];
  const p2 = [tx + w, ty + hh];
  const p3 = [tx + w, ty + hh + d];
  const p4 = [tx, ty + hh + hh + d];
  const p5 = [tx - w, ty + hh + d];
  const p6 = [tx - w, ty + hh];
  const c = [tx, ty + hh + hh];

  const silhouette =
    `M ${p1[0]} ${p1[1]} L ${p2[0]} ${p2[1]} L ${p3[0]} ${p3[1]} ` +
    `L ${p4[0]} ${p4[1]} L ${p5[0]} ${p5[1]} L ${p6[0]} ${p6[1]} Z`;

  // The Y: centre out to both upper side vertices and down to the bottom.
  const interior =
    `M ${p6[0]} ${p6[1]} L ${c[0]} ${c[1]} L ${p2[0]} ${p2[1]} ` +
    `M ${c[0]} ${c[1]} L ${p4[0]} ${p4[1]}`;

  return `${silhouette} ${interior}`;
}

// Fitted constants — see the header note. w/hh/d derive from one edge length.
const W = 10.5; // half-width of a cube's top rhombus
const HH = 6.06; // half-height of that rhombus
const D = 12.13; // vertical edge

const CUBES = [
  cube(13.5, 2.78, W, HH, D), // upper left   — lattice (0, 1, 0)
  cube(34.5, 2.78, W, HH, D), // upper right  — lattice (1, 0, 0)
  cube(24.0, 20.97, W, HH, D), // lower centre — lattice (1, 1, -1)
];

export function WinbackMark({
  size = 40,
  strokeWidth = 2.4,
  className,
  title,
}: WinbackMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {CUBES.map((d, i) => (
        <path
          key={i}
          d={d}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
