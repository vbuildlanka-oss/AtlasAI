// embed-gallery.mjs
// Computes CLIP image embeddings for the demo gallery so the web app can
// search instantly without embedding 36 images on every page load. The web
// app uses the *same* model + quantization, so embeddings are directly
// comparable to text queries and user-uploaded images embedded in-browser.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AutoProcessor,
  CLIPVisionModelWithProjection,
  RawImage,
} from "@huggingface/transformers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GALLERY = path.resolve(__dirname, "../web/public/gallery");
export const MODEL_ID = "Xenova/clip-vit-base-patch32";
export const DTYPE = "q8";

function l2normalize(vec) {
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return vec.map((v) => v / norm);
}

export async function loadVision() {
  const processor = await AutoProcessor.from_pretrained(MODEL_ID);
  const model = await CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, {
    dtype: DTYPE,
  });
  return { processor, model };
}

export async function embedImageFile(processor, model, absPath) {
  const image = await RawImage.read(absPath);
  const inputs = await processor(image);
  const { image_embeds } = await model(inputs);
  return l2normalize(image_embeds.tolist()[0]);
}

async function main() {
  const manifest = JSON.parse(
    await readFile(path.join(GALLERY, "manifest.json"), "utf-8"),
  );
  console.log(`Loading CLIP vision tower (${MODEL_ID}, ${DTYPE})...`);
  const { processor, model } = await loadVision();

  const embeddings = [];
  let dim = 0;
  for (const item of manifest.items) {
    const abs = path.join(GALLERY, "..", item.file);
    const emb = await embedImageFile(processor, model, abs);
    dim = emb.length;
    embeddings.push({ id: item.id, v: emb.map((x) => Math.round(x * 1e5) / 1e5) });
    process.stdout.write(`\rEmbedded ${embeddings.length}/${manifest.items.length}`);
  }

  const out = {
    model: MODEL_ID,
    dtype: DTYPE,
    dim,
    normalized: true,
    count: embeddings.length,
    embeddings,
  };
  await writeFile(path.join(GALLERY, "embeddings.json"), JSON.stringify(out));
  const kb = (JSON.stringify(out).length / 1024).toFixed(1);
  console.log(`\nWrote embeddings.json (${kb} KB, dim=${dim})`);
}

// Only run when invoked directly (evaluate.mjs imports helpers from here).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
