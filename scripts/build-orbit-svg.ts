// ============================================================================
// scripts/build-orbit-svg.ts — pnpm build:orbit
//
// Takes the supplied orbit animation in design/reference/, removes its gear
// cluster, and drops the Winback mark in its place — "like this but minus the
// gears in the middle and instead our logo".
//
// Everything else is untouched: the orbiting product marks, the counter-
// rotating rings, the original SMIL timing. Output is public/anim/orbit-winback.svg.
//
// A script rather than a hand-edit so that re-running it against an updated
// reference is one command, and so the edit is recorded rather than mysterious.
// ============================================================================

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const SOURCE = path.join('design', 'reference', 'integration-orbit.svg');
const OUTPUT = path.join('public', 'anim', 'orbit-winback.svg');

/** Same computed isometric geometry as WinbackMark — see that file's header. */
function cubePath(tx: number, ty: number, w: number, hh: number, d: number): string {
  const p1 = [tx, ty];
  const p2 = [tx + w, ty + hh];
  const p3 = [tx + w, ty + hh + d];
  const p4 = [tx, ty + hh + hh + d];
  const p5 = [tx - w, ty + hh + d];
  const p6 = [tx - w, ty + hh];
  const c = [tx, ty + hh + hh];
  const j = (a: number[]) => `${a[0]} ${a[1]}`;
  return (
    `M ${j(p1)} L ${j(p2)} L ${j(p3)} L ${j(p4)} L ${j(p5)} L ${j(p6)} Z ` +
    `M ${j(p6)} L ${j(c)} L ${j(p2)} M ${j(c)} L ${j(p4)}`
  );
}

/** Top-level <g> siblings, in document order. */
function topLevelGroups(body: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  let depth = 0;
  let start = 0;
  for (const m of body.matchAll(/<(\/?)g\b[^>]*?>/g)) {
    if (m[1] === '') {
      if (depth === 0) start = m.index!;
      depth += 1;
    } else {
      depth -= 1;
      if (depth === 0) spans.push([start, m.index! + m[0].length]);
    }
  }
  return spans;
}

function main() {
  const svg = readFileSync(SOURCE, 'utf-8');
  const head = /^<svg[^>]*>/.exec(svg)?.[0];
  if (!head) throw new Error(`${SOURCE} does not start with an <svg> tag`);
  const body = svg.slice(head.length, -'</svg>'.length);

  const groups = topLevelGroups(body);
  if (groups.length === 0) throw new Error('no top-level groups found — is the reference file intact?');

  // The gear cluster is the first top-level group: the only one drawn under a
  // scale matrix offset from the composition centre. Asserted rather than
  // assumed, so an updated reference fails loudly instead of silently keeping
  // the gears.
  const [gearStart, gearEnd] = groups[0]!;
  const gear = body.slice(gearStart, gearEnd);
  if (!/matrix\(1\.7/.test(gear.slice(0, 200))) {
    throw new Error('first group is not the expected gear cluster; inspect the reference before rebuilding');
  }

  const W = 10.5;
  const HH = 6.06;
  const D = 12.13;
  const cubes = [cubePath(13.5, 2.78, W, HH, D), cubePath(34.5, 2.78, W, HH, D), cubePath(24, 20.97, W, HH, D)];
  const paths = cubes
    .map(
      (d) =>
        `<path d="${d}" fill="none" stroke="#1F1E1C" stroke-width="2.2" ` +
        `stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join('');

  // The 48-unit mark, scaled and centred on the 500x500 composition centre.
  const scale = 2.8;
  const offset = 250 - 24 * scale;
  const mark = `<g transform="translate(${offset.toFixed(2)},${offset.toFixed(2)}) scale(${scale})">${paths}</g>`;

  const out = head + body.slice(0, gearStart) + body.slice(gearEnd) + mark + '</svg>';
  mkdirSync(path.dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, out);

  console.log(`  removed gear cluster (${gearEnd - gearStart} bytes)`);
  console.log(`  wrote ${OUTPUT} (${out.length} bytes)`);
}

main();
