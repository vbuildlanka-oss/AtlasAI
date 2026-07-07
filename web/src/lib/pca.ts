// Matrix-free 2-component PCA for visualising the CLIP embedding space.
// Uses power iteration on the (implicit) covariance so we never materialise a
// 512x512 matrix. Good enough to reveal semantic clustering in the "galaxy".

function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

// w = (Xc^T Xc) v  where Xc is the centered data matrix (rows = samples)
function covMul(centered: Float32Array[], v: Float32Array): Float32Array {
  const d = v.length;
  const out = new Float32Array(d);
  for (const x of centered) {
    const proj = dot(x, v);
    for (let i = 0; i < d; i++) out[i] += proj * x[i];
  }
  return out;
}

function normalize(v: Float32Array): Float32Array {
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / n;
  return out;
}

function powerIteration(
  centered: Float32Array[],
  d: number,
  orthoTo: Float32Array | null,
  iters = 60,
): Float32Array {
  let v: Float32Array = new Float32Array(d);
  for (let i = 0; i < d; i++) v[i] = (Math.sin((i + 1) * 12.9898) * 43758.5453) % 1; // deterministic seed
  v = normalize(v);
  for (let k = 0; k < iters; k++) {
    const w: Float32Array = covMul(centered, v);
    if (orthoTo) {
      const p = dot(w, orthoTo);
      for (let i = 0; i < d; i++) w[i] -= p * orthoTo[i];
    }
    v = normalize(w);
  }
  return v;
}

export interface Point2D {
  x: number;
  y: number;
}

export class PCA2D {
  private mean!: Float32Array;
  private pc1!: Float32Array;
  private pc2!: Float32Array;

  fit(vectors: Float32Array[]): void {
    const d = vectors[0].length;
    const mean = new Float32Array(d);
    for (const v of vectors) for (let i = 0; i < d; i++) mean[i] += v[i];
    for (let i = 0; i < d; i++) mean[i] /= vectors.length;
    this.mean = mean;

    const centered = vectors.map((v) => {
      const c = new Float32Array(d);
      for (let i = 0; i < d; i++) c[i] = v[i] - mean[i];
      return c;
    });

    this.pc1 = powerIteration(centered, d, null);
    this.pc2 = powerIteration(centered, d, this.pc1);
  }

  project(v: Float32Array): Point2D {
    let x = 0, y = 0;
    for (let i = 0; i < v.length; i++) {
      const c = v[i] - this.mean[i];
      x += c * this.pc1[i];
      y += c * this.pc2[i];
    }
    return { x, y };
  }
}
