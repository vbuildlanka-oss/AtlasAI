// build-gallery.mjs
// Assembles a small, diverse demo gallery from Openverse (openverse.org),
// which indexes Creative-Commons / public-domain images. We keep full
// attribution (creator, license, source) for every image so the demo is
// license-compliant out of the box.
import { mkdir, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../web/public/gallery");
const IMG_DIR = path.join(OUT, "img");
const UA = "IrisNeuralPhotoSearch/1.0 (educational demo)";
const PER_CATEGORY = 3;

// category label -> Openverse search query
const CATEGORIES = {
  dog: "dog portrait",
  cat: "cat portrait",
  beach: "tropical beach ocean",
  mountains: "mountain landscape",
  city: "city skyline night",
  food: "pizza plate food",
  coffee: "cup of coffee",
  flowers: "flower blossom macro",
  car: "vintage car",
  bicycle: "bicycle street",
  sunset: "sunset sky clouds",
  forest: "forest path trees",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function search(query) {
  const url =
    "https://api.openverse.org/v1/images/?" +
    new URLSearchParams({
      q: query,
      license_type: "commercial", // permits commercial use
      page_size: "20",
      mature: "false",
    });
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Openverse ${res.status} for "${query}"`);
  const json = await res.json();
  return json.results ?? [];
}

async function download(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`download ${res.status}`);
  const type = res.headers.get("content-type") ?? "";
  if (!/image\/(jpe?g|png|webp)/i.test(type)) throw new Error(`bad type ${type}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength < 3000) throw new Error("too small");
  return buf;
}

async function main() {
  if (existsSync(OUT)) await rm(OUT, { recursive: true, force: true });
  await mkdir(IMG_DIR, { recursive: true });

  const manifest = [];
  let index = 0;

  for (const [label, query] of Object.entries(CATEGORIES)) {
    process.stdout.write(`\n[${label}] "${query}" `);
    let candidates = [];
    try {
      candidates = await search(query);
    } catch (e) {
      console.log(`search failed: ${e.message}`);
      continue;
    }

    let kept = 0;
    for (const c of candidates) {
      if (kept >= PER_CATEGORY) break;
      const src = c.thumbnail || c.url;
      if (!src) continue;
      try {
        const buf = await download(src);
        const file = `${String(index).padStart(3, "0")}.jpg`;
        await writeFile(path.join(IMG_DIR, file), buf);
        manifest.push({
          id: index,
          file: `gallery/img/${file}`,
          category: label,
          title: (c.title ?? "").trim().slice(0, 120) || "Untitled",
          creator: (c.creator ?? "Unknown").trim(),
          license: `${c.license ?? ""} ${c.license_version ?? ""}`.trim().toUpperCase(),
          licenseUrl: c.license_url ?? "",
          source: c.foreign_landing_url ?? c.url ?? "",
          provider: c.provider ?? "",
        });
        index++;
        kept++;
        process.stdout.write("+");
      } catch {
        process.stdout.write(".");
      }
      await sleep(150);
    }
    if (kept < PER_CATEGORY) process.stdout.write(` (only ${kept})`);
    await sleep(300);
  }

  await writeFile(
    path.join(OUT, "manifest.json"),
    JSON.stringify({ builtAt: new Date().toISOString(), count: manifest.length, items: manifest }, null, 2),
  );

  console.log(`\n\nDone. ${manifest.length} images across ${Object.keys(CATEGORIES).length} categories.`);
  console.log(`Manifest -> ${path.join(OUT, "manifest.json")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
