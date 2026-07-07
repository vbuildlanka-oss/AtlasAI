// evaluate.mjs
// Quantifies retrieval quality of the CLIP text->image search on the demo
// gallery: for each category we issue a natural-language query and measure
// how well same-category images are ranked. Reports precision@k, MRR and mAP
// (mean average precision). Output feeds the "Model quality" panel in the UI.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AutoTokenizer,
  CLIPTextModelWithProjection,
} from "@huggingface/transformers";
import { MODEL_ID, DTYPE } from "./embed-gallery.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GALLERY = path.resolve(__dirname, "../web/public/gallery");

// category -> natural language query for evaluation
const QUERIES = {
  dog: "a photo of a dog",
  cat: "a photo of a cat",
  beach: "a photo of a tropical beach",
  mountains: "a photo of mountains",
  city: "a photo of a city skyline at night",
  food: "a photo of a pizza",
  coffee: "a photo of a cup of coffee",
  flowers: "a photo of a flower",
  car: "a photo of a car",
  bicycle: "a photo of a bicycle",
  sunset: "a photo of a sunset",
  forest: "a photo of a forest",
};

function l2normalize(vec) {
  let n = 0;
  for (const v of vec) n += v * v;
  n = Math.sqrt(n) || 1;
  return vec.map((v) => v / n);
}
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);

function averagePrecision(rankedRelevance) {
  let hits = 0, sum = 0;
  rankedRelevance.forEach((rel, i) => {
    if (rel) {
      hits++;
      sum += hits / (i + 1);
    }
  });
  return hits ? sum / hits : 0;
}

async function main() {
  const manifest = JSON.parse(await readFile(path.join(GALLERY, "manifest.json"), "utf-8"));
  const embData = JSON.parse(await readFile(path.join(GALLERY, "embeddings.json"), "utf-8"));
  const catById = new Map(manifest.items.map((i) => [i.id, i.category]));
  const embById = new Map(embData.embeddings.map((e) => [e.id, e.v]));

  console.log(`Loading CLIP text tower (${MODEL_ID}, ${DTYPE})...`);
  const tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
  const textModel = await CLIPTextModelWithProjection.from_pretrained(MODEL_ID, { dtype: DTYPE });

  const ids = embData.embeddings.map((e) => e.id);
  const perQuery = [];
  const K = [1, 3, 5];

  for (const [category, query] of Object.entries(QUERIES)) {
    const inputs = tokenizer([query], { padding: true, truncation: true });
    const { text_embeds } = await textModel(inputs);
    const q = l2normalize(text_embeds.tolist()[0]);

    const ranked = ids
      .map((id) => ({ id, score: dot(q, embById.get(id)) }))
      .sort((a, b) => b.score - a.score);

    const relevance = ranked.map((r) => catById.get(r.id) === category);
    const nRelevant = relevance.filter(Boolean).length;

    const pAt = Object.fromEntries(
      K.map((k) => [k, relevance.slice(0, k).filter(Boolean).length / k]),
    );
    const rr = 1 / (relevance.findIndex(Boolean) + 1 || Infinity);
    const ap = averagePrecision(relevance);

    perQuery.push({
      query,
      category,
      nRelevant,
      pAt,
      rr: Number(rr.toFixed(3)),
      ap: Number(ap.toFixed(3)),
      topIds: ranked.slice(0, 5).map((r) => r.id),
    });
  }

  const mean = (f) => Number((perQuery.reduce((s, q) => s + f(q), 0) / perQuery.length).toFixed(3));
  const aggregate = {
    queries: perQuery.length,
    gallerySize: ids.length,
    mAP: mean((q) => q.ap),
    mrr: mean((q) => q.rr),
    pAt: Object.fromEntries(K.map((k) => [k, mean((q) => q.pAt[k])])),
  };

  const out = { model: MODEL_ID, evaluatedAt: new Date().toISOString(), aggregate, perQuery };
  await writeFile(path.join(GALLERY, "eval.json"), JSON.stringify(out, null, 2));

  console.log("\n=== Retrieval quality (text -> image) ===");
  console.log(`gallery size : ${aggregate.gallerySize} images, ${aggregate.queries} queries`);
  console.log(`P@1 = ${aggregate.pAt[1]}   P@3 = ${aggregate.pAt[3]}   P@5 = ${aggregate.pAt[5]}`);
  console.log(`MRR = ${aggregate.mrr}   mAP = ${aggregate.mAP}`);
  console.log(`\nWrote eval.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
