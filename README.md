# 🔮 Iris — Neural Photo Search

**Search your photos by describing them.** Type *"a dog playing outside"* or
*"city lights at night"* and Iris finds the matching images — powered by
OpenAI's **CLIP** vision-language model running **100% in your browser**.

No server. No API keys. No uploads. The neural network downloads once and
every embedding, search, and tag is computed on your device. Built entirely
with **free, open-source** tools (Hugging Face Transformers.js, ONNX Runtime
Web, React, Vite) and **Creative-Commons** demo imagery.

> **The interesting bit:** this isn't an app that calls a hosted API — it *is*
> the model. A 512-dimension multimodal embedding space is computed
> client-side, image and text land in the *same* space, and search is just
> cosine similarity. The result is private, offline-capable, and free to host
> as a static site.

---

## ✨ Features

| Feature | What it shows |
|---|---|
| **Natural-language search** | Text → image retrieval via shared CLIP embedding space. |
| **Reverse image search** | "Find visually similar" using image → image cosine similarity. |
| **Bring your own photos** | Drag in images; they're embedded locally with the CLIP vision tower and become instantly searchable. |
| **Zero-shot tagging** | Any image is scored against an open vocabulary — no training, no fixed label set. |
| **Embedding galaxy** | 512-D vectors projected to 2-D with a hand-rolled PCA; semantically similar photos visibly cluster and your query lands among them. |
| **Measured quality** | Retrieval is evaluated offline (precision@k, MRR, mAP) — not just vibes. |

---

## 📊 Retrieval quality

Measured by [`scripts/evaluate.mjs`](scripts/evaluate.mjs) on the demo gallery
(12 natural-language queries over 36 labelled images, text → image):

| Metric | Score |
|---|---|
| **mean Average Precision (mAP)** | **0.982** |
| **Mean Reciprocal Rank (MRR)** | **1.00** |
| **Precision@1** | **1.00** |
| **Precision@3** | **0.94** |

Every query's top result is in the correct category, with near-perfect overall
ranking. Reproducible offline with `npm run evaluate`.

---

## 🧠 The model

- **CLIP ViT-B/32** ([`Xenova/clip-vit-base-patch32`](https://huggingface.co/Xenova/clip-vit-base-patch32)) — the open-source contrastive vision-language model.
- Served as **quantised (int8) ONNX** and executed with **ONNX Runtime Web** (WASM) via **Transformers.js**.
- The **exact same model + quantisation** is used offline (Node) and in the browser, so precomputed gallery embeddings are directly comparable to live text queries and user uploads — no train/serve skew.
- **Lazy, split loading:** the text tower loads first (needed for search); the vision tower loads only when you upload an image. Single-threaded WASM avoids the `SharedArrayBuffer`/COOP-COEP requirement, so it runs on any plain static host.

---

## 🏗️ Architecture

```
        OFFLINE TOOLING (Node)                         BROWSER (React + Transformers.js)
 ┌──────────────────────────────────────┐      ┌────────────────────────────────────────┐
 │ build-gallery.mjs                     │      │ 1. load precomputed gallery embeddings   │
 │   Openverse API ─► CC images + attrib │      │ 2. load CLIP text tower (once, cached)   │
 │ embed-gallery.mjs                     │      │ 3. embed query text ─► cosine similarity │
 │   CLIP vision ─► embeddings.json ─────┼───►  │    against gallery + your uploads        │
 │ evaluate.mjs                          │      │ 4. vision tower (lazy) embeds uploads    │
 │   precision@k / MRR / mAP ─► eval.json│      │ 5. PCA galaxy · zero-shot tags           │
 └──────────────────────────────────────┘      │  everything on-device · nothing uploaded │
                                                └────────────────────────────────────────┘
```

Same model on both sides ⇒ the numbers you measure offline are the numbers you
get in the browser.

---

## 📁 Project structure

```
.
├── scripts/                 # offline ML tooling (Node + @huggingface/transformers)
│   ├── build-gallery.mjs     # fetch CC-licensed images (Openverse) with attribution
│   ├── embed-gallery.mjs     # CLIP image embeddings -> embeddings.json
│   └── evaluate.mjs          # retrieval metrics -> eval.json
└── web/                     # React + TS + Vite app (static, no backend)
    ├── src/lib/clip.ts        # in-browser CLIP: lazy towers, progress, embeddings
    ├── src/lib/search.ts      # cosine similarity ranking
    ├── src/lib/pca.ts         # matrix-free 2-component PCA for the galaxy
    ├── src/components/        # search bar, grid, upload, galaxy, tags, quality panel
    └── public/gallery/        # generated: images + embeddings.json + eval.json
```

---

## 🚀 Run it locally

**1. (Optional) regenerate the demo gallery + embeddings + metrics:**

```bash
cd scripts
npm install
npm run gallery     # download CC images from Openverse
npm run embed       # compute CLIP embeddings
npm run evaluate    # print + save retrieval metrics
```

*(The generated artifacts are committed, so this step is optional.)*

**2. Launch the app:**

```bash
cd web
npm install
npm run dev         # http://localhost:5173
```

On first search the CLIP model (~a few tens of MB, int8) downloads from the
Hugging Face hub and is cached by the browser. Everything after is instant and
offline.

---

## 🌐 Deploy for free (static site)

`npm run build` (in `web/`) produces a fully static `dist/` — the ONNX Runtime
WASM is bundled and served from your own origin. Host it anywhere free:

- **GitHub Pages** (CI workflow included), **Netlify**, **Vercel**, **Cloudflare Pages**.
- Set base directory `web`, build `npm run build`, publish `dist`.

Because all inference is client-side, hosting cost is **$0** and it scales to
any number of users with no backend.

---

## 🔬 Engineering notes

- **No train/serve skew:** one model id + quantisation shared by the offline
  tooling and the browser; gallery/query/upload embeddings are mutually comparable.
- **Honest evaluation:** retrieval metrics are computed on the actual shipped
  embeddings, not hand-picked examples.
- **Privacy by construction:** images and queries are processed in-page; nothing
  is sent to any server.
- **Licensing:** demo images are Creative-Commons / public-domain, retrieved
  with full attribution (creator, license, source) via
  [Openverse](https://openverse.org).

## ⚠️ Notes & limits

- First load downloads the model; subsequent loads use the browser cache.
- CLIP reflects biases in its training data; zero-shot tags are approximate and
  meant as a demonstration, not ground truth.
- This is an educational showcase of applied ML engineering.
