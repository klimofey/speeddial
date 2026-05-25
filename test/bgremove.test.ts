import { describe, it, expect } from 'vitest';
import { floodFillTransparent } from '../src/lib/bgremove';

function makeImg(w: number, h: number, fill: (x: number, y: number) => [number, number, number, number]) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const [r, g, b, a] = fill(i % w, Math.floor(i / w));
    px[i * 4] = r; px[i * 4 + 1] = g; px[i * 4 + 2] = b; px[i * 4 + 3] = a;
  }
  return px;
}
const alphaAt = (px: Uint8ClampedArray, w: number) => (x: number, y: number) => px[(y * w + x) * 4 + 3];

describe('floodFillTransparent', () => {
  it('clears the solid border-connected background and keeps the inner shape', () => {
    const w = 4, h = 4;
    const px = makeImg(w, h, (x, y) => (x >= 1 && x <= 2 && y >= 1 && y <= 2 ? [255, 0, 0, 255] : [255, 255, 255, 255]));
    floodFillTransparent(px, w, h, 30);
    const a = alphaAt(px, w);
    expect(a(0, 0)).toBe(0); // corner (white) → transparent
    expect(a(3, 3)).toBe(0);
    expect(a(0, 2)).toBe(0);
    expect(a(1, 1)).toBe(255); // inner red kept
    expect(a(2, 2)).toBe(255);
  });

  it('does not punch a hole in an enclosed region matching the bg colour', () => {
    const w = 5, h = 5;
    const px = makeImg(w, h, (x, y) => {
      if (x === 0 || y === 0 || x === 4 || y === 4) return [255, 255, 255, 255]; // border (white)
      if (x === 2 && y === 2) return [255, 255, 255, 255];                       // enclosed white
      return [255, 0, 0, 255];                                                   // red ring
    });
    floodFillTransparent(px, w, h, 30);
    const a = alphaAt(px, w);
    expect(a(0, 0)).toBe(0);   // border cleared
    expect(a(1, 1)).toBe(255); // red ring kept
    expect(a(2, 2)).toBe(255); // enclosed white NOT cleared — flood-fill, not global match
  });
});
