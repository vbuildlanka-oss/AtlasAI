import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base -> the static build works on GitHub Pages, Netlify, Vercel,
// Cloudflare Pages or any sub-path with no reconfiguration.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { outDir: "dist", target: "esnext", sourcemap: false },
  // transformers.js pulls in large, dynamically-imported chunks + wasm; let it
  // resolve those itself instead of pre-bundling.
  optimizeDeps: { exclude: ["@huggingface/transformers"] },
});
