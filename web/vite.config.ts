import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the static build works on GitHub Pages, Netlify, Vercel,
// Cloudflare Pages, or any sub-path without reconfiguration.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { outDir: "dist", sourcemap: false },
});
