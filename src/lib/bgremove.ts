// Makes a solid image background transparent by flood-filling from the edges:
// pixels matching the border colour AND reachable from a border (4-connected) become
// transparent. Flood-fill (not a global colour match) avoids punching holes in a logo
// that happens to contain the background colour.

// Pure, DOM-free core so it can be unit-tested without a canvas. Mutates `px` (RGBA).
export function floodFillTransparent(px: Uint8ClampedArray, w: number, h: number, tolerance = 40): void {
  if (w <= 0 || h <= 0) return;
  // Background colour = average of the four corners.
  const corners = [0, (w - 1), (h - 1) * w, (h - 1) * w + (w - 1)].map((p) => p * 4);
  let br = 0, bg = 0, bb = 0;
  for (const c of corners) { br += px[c]; bg += px[c + 1]; bb += px[c + 2]; }
  br /= 4; bg /= 4; bb /= 4;
  const tol2 = tolerance * tolerance;
  const matches = (i: number) => {
    const dr = px[i] - br, dg = px[i + 1] - bg, db = px[i + 2] - bb;
    return dr * dr + dg * dg + db * db <= tol2;
  };

  const visited = new Uint8Array(w * h);
  const stack: number[] = [];
  const enqueue = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (visited[p]) return;
    visited[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < w; x++) { enqueue(x, 0); enqueue(x, h - 1); }
  for (let y = 0; y < h; y++) { enqueue(0, y); enqueue(w - 1, y); }

  while (stack.length) {
    const p = stack.pop()!;
    const i = p * 4;
    if (!matches(i)) continue; // a non-background pixel (e.g. the logo) stops the fill
    px[i + 3] = 0;
    const x = p % w;
    const y = (p - x) / w;
    enqueue(x + 1, y); enqueue(x - 1, y); enqueue(x, y + 1); enqueue(x, y - 1);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}

// Loads `src` (data: URL or CORS-readable URL), flood-fills the background to transparent,
// and returns a PNG data URL. Throws if the image can't be read (e.g. a tainted canvas).
export async function removeBackground(src: string, tolerance = 40): Promise<string> {
  const img = await loadImage(src);
  const w = img.naturalWidth, h = img.naturalHeight;
  if (!w || !h) throw new Error('empty image');
  const scale = Math.min(1, 256 / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.drawImage(img, 0, 0, cw, ch);
  const imageData = ctx.getImageData(0, 0, cw, ch); // throws if the canvas is tainted
  floodFillTransparent(imageData.data, cw, ch, tolerance);
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}
