// Browser-side CLIP. The exact same model + quantisation used by the offline
// tooling (Xenova/clip-vit-base-patch32, q8) so query/upload embeddings are
// directly comparable to the precomputed gallery embeddings.
//
// The two towers are loaded lazily and independently:
//   * text tower   -> needed for search + zero-shot tagging (loaded first)
//   * vision tower -> only needed to embed user-uploaded images
import {
  env,
  AutoTokenizer,
  CLIPTextModelWithProjection,
  AutoProcessor,
  CLIPVisionModelWithProjection,
  RawImage,
  type PreTrainedTokenizer,
  type Processor,
} from "@huggingface/transformers";

export const MODEL_ID = "Xenova/clip-vit-base-patch32";
export const DTYPE = "q8";

// Fetch weights from the HF hub; single-threaded wasm avoids the COOP/COEP
// (SharedArrayBuffer) requirement so it runs on any plain static host.
env.allowLocalModels = false;
const wasmBackend = env.backends?.onnx?.wasm;
if (wasmBackend) wasmBackend.numThreads = 1;

export function l2normalize(v: number[] | Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < v.length; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm) || 1;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / norm;
  return out;
}

// ---- progress plumbing ----------------------------------------------------
export type LoadState = "idle" | "loading" | "ready" | "error";
export interface Progress {
  tower: "text" | "vision";
  state: LoadState;
  pct: number; // 0..1 aggregate download progress
  label: string;
}
type Listener = (p: Progress) => void;

class Tracker {
  private files = new Map<string, { loaded: number; total: number }>();
  constructor(
    private tower: "text" | "vision",
    private emit: (p: Progress) => void,
  ) {}
  cb = (data: any) => {
    if (data.status === "progress" && data.file) {
      this.files.set(data.file, { loaded: data.loaded ?? 0, total: data.total ?? 0 });
      let l = 0, t = 0;
      for (const f of this.files.values()) {
        l += f.loaded;
        t += f.total;
      }
      const pct = t > 0 ? l / t : 0;
      this.emit({ tower: this.tower, state: "loading", pct, label: `Downloading ${this.tower} model… ${(pct * 100) | 0}%` });
    }
  };
}

const listeners = new Set<Listener>();
export function onProgress(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function broadcast(p: Progress) {
  listeners.forEach((l) => l(p));
}

// ---- lazy singletons ------------------------------------------------------
let textPromise: Promise<{ tokenizer: PreTrainedTokenizer; model: any }> | null = null;
let visionPromise: Promise<{ processor: Processor; model: any }> | null = null;

export function ensureText() {
  if (!textPromise) {
    broadcast({ tower: "text", state: "loading", pct: 0, label: "Downloading text model…" });
    const tracker = new Tracker("text", broadcast);
    textPromise = (async () => {
      const tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID, { progress_callback: tracker.cb });
      const model = await CLIPTextModelWithProjection.from_pretrained(MODEL_ID, {
        dtype: DTYPE,
        progress_callback: tracker.cb,
      });
      broadcast({ tower: "text", state: "ready", pct: 1, label: "Text model ready" });
      return { tokenizer, model };
    })().catch((e) => {
      broadcast({ tower: "text", state: "error", pct: 0, label: String(e) });
      textPromise = null;
      throw e;
    });
  }
  return textPromise;
}

export function ensureVision() {
  if (!visionPromise) {
    broadcast({ tower: "vision", state: "loading", pct: 0, label: "Downloading vision model…" });
    const tracker = new Tracker("vision", broadcast);
    visionPromise = (async () => {
      const processor = await AutoProcessor.from_pretrained(MODEL_ID, { progress_callback: tracker.cb });
      const model = await CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, {
        dtype: DTYPE,
        progress_callback: tracker.cb,
      });
      broadcast({ tower: "vision", state: "ready", pct: 1, label: "Vision model ready" });
      return { processor, model };
    })().catch((e) => {
      broadcast({ tower: "vision", state: "error", pct: 0, label: String(e) });
      visionPromise = null;
      throw e;
    });
  }
  return visionPromise;
}

// ---- embedding APIs -------------------------------------------------------
export async function embedTexts(texts: string[]): Promise<Float32Array[]> {
  const { tokenizer, model } = await ensureText();
  const inputs = tokenizer(texts, { padding: true, truncation: true });
  const { text_embeds } = await model(inputs);
  return (text_embeds.tolist() as number[][]).map(l2normalize);
}

export async function embedText(text: string): Promise<Float32Array> {
  return (await embedTexts([text]))[0];
}

export async function embedImageUrl(url: string): Promise<Float32Array> {
  const { processor, model } = await ensureVision();
  const image = await RawImage.fromURL(url);
  const inputs = await processor(image);
  const { image_embeds } = await model(inputs);
  return l2normalize((image_embeds.tolist() as number[][])[0]);
}
