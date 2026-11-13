// Board geometry. Board is 7 rows; even rows have 6 hexes (shifted right by
// half a hex), odd rows have 7. This shape is point-symmetric, giving both
// players an identical map and a true centre hex.
//
// Storage uses offset coords (col,row). Distance/neighbours use axial (q,r)
// with "even-r" offset conversion.

export const ROWS = 7;
export const rowWidth = (row: number) => (row % 2 === 0 ? 6 : 7);

export interface Pos { col: number; row: number }

export const key = (p: Pos) => `${p.col},${p.row}`;
export const samePos = (a: Pos, b: Pos) => a.col === b.col && a.row === b.row;

export function inBounds(p: Pos): boolean {
  return p.row >= 0 && p.row < ROWS && p.col >= 0 && p.col < rowWidth(p.row);
}

// even-r: even rows are shoved right by half a hex.
export function toAxial(p: Pos): { q: number; r: number } {
  return { q: p.col - ((p.row + (p.row & 1)) >> 1), r: p.row };
}
export function fromAxial(q: number, r: number): Pos {
  return { col: q + ((r + (r & 1)) >> 1), row: r };
}

export const AXIAL_DIRS: [number, number][] = [
  [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1],
];

export function neighbors(p: Pos): Pos[] {
  const a = toAxial(p);
  const out: Pos[] = [];
  for (const [dq, dr] of AXIAL_DIRS) {
    const n = fromAxial(a.q + dq, a.r + dr);
    if (inBounds(n)) out.push(n);
  }
  return out;
}

export function distance(a: Pos, b: Pos): number {
  const A = toAxial(a), B = toAxial(b);
  const dq = A.q - B.q, dr = A.r - B.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export function step(p: Pos, dir: number, n = 1): Pos {
  const a = toAxial(p);
  const [dq, dr] = AXIAL_DIRS[dir];
  return fromAxial(a.q + dq * n, a.r + dr * n);
}

/** Hexes strictly between a and b along a straight-ish line (cube lerp). */
export function lineBetween(a: Pos, b: Pos): Pos[] {
  const n = distance(a, b);
  if (n <= 1) return [];
  const A = toAxial(a), B = toAxial(b);
  const out: Pos[] = [];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    // nudge to avoid ties on exact edges
    const q = A.q + (B.q - A.q) * t + 1e-6;
    const r = A.r + (B.r - A.r) * t + 1e-6;
    out.push(cubeRound(q, r));
  }
  return out;
}

function cubeRound(q: number, r: number): Pos {
  const s = -q - r;
  let rq = Math.round(q), rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return fromAxial(rq, rr);
}

/** Point reflection through the board centre (3,3). */
export function mirror(p: Pos): Pos {
  // centre (3,3) -> axial q = 3 - 2 = 1, r = 3. reflection: (2 - q, 6 - r)
  const a = toAxial(p);
  return fromAxial(2 - a.q, 6 - a.r);
}

export function allHexes(): Pos[] {
  const out: Pos[] = [];
  for (let row = 0; row < ROWS; row++)
    for (let col = 0; col < rowWidth(row); col++) out.push({ col, row });
  return out;
}
