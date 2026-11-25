/**
 * Pointy-top hexagon math using axial coordinates (q, r).
 * See https://www.redblobgames.com/grids/hexagons/
 */
export const SQRT3 = Math.sqrt(3);

export interface Axial {
  q: number;
  r: number;
}

export const hexId = (q: number, r: number) => `${q},${r}`;

export function hexToPixel(q: number, r: number, size: number): [number, number] {
  return [size * SQRT3 * (q + r / 2), size * 1.5 * r];
}

export function pixelToHex(x: number, y: number, size: number): Axial {
  const q = ((SQRT3 / 3) * x - (1 / 3) * y) / size;
  const r = ((2 / 3) * y) / size;
  return axialRound(q, r);
}

export function axialRound(fq: number, fr: number): Axial {
  const fs = -fq - fr;
  let q = Math.round(fq);
  let r = Math.round(fr);
  const s = Math.round(fs);
  const dq = Math.abs(q - fq);
  const dr = Math.abs(r - fr);
  const ds = Math.abs(s - fs);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  // Normalise -0 so ids are stable.
  return { q: q + 0, r: r + 0 };
}

/** Odd-r offset (col, row) → axial. */
export function offsetToAxial(col: number, row: number): Axial {
  return { q: col - (row - (row & 1)) / 2, r: row };
}

/** Corner offsets for a pointy-top hex of the given radius, relative to its center. */
export function hexCorners(size: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    out.push([size * Math.cos(a), size * Math.sin(a)]);
  }
  return out;
}

/** SVG path for a hex centered at (cx, cy). */
export function hexPath(cx: number, cy: number, corners: Array<[number, number]>): string {
  let d = "";
  for (let i = 0; i < corners.length; i++) {
    const c = corners[i]!;
    d += `${i === 0 ? "M" : "L"}${(cx + c[0]).toFixed(2)},${(cy + c[1]).toFixed(2)}`;
  }
  return d + "Z";
}
