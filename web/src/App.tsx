import { useEffect, useMemo, useRef, useState } from "react";
import type { EmbeddingsFile, EvalFile, Manifest, Photo, Scored, Tag } from "./types";
import { embedText, embedImageUrl, embedTexts, onProgress, type Progress } from "./lib/clip";
import { cosine, rank, findSimilar } from "./lib/search";
import { TAG_VOCAB } from "./lib/vocab";
import SearchBar from "./components/SearchBar";
import PhotoGrid from "./components/PhotoGrid";
import UploadZone from "./components/UploadZone";
import Galaxy from "./components/Galaxy";
import QualityPanel from "./components/QualityPanel";
import PhotoModal from "./components/PhotoModal";

const BASE = import.meta.env.BASE_URL;

export default function App() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [evalData, setEvalData] = useState<EvalFile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [results, setResults] = useState<Scored[] | null>(null);
  const [activeLabel, setActiveLabel] = useState<string>("");
  const [queryEmbedding, setQueryEmbedding] = useState<Float32Array | null>(null);

  const [searchBusy, setSearchBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);

  const [selectedId, setSelectedId] = useState<number | undefined>(undefined);
  const [tags, setTags] = useState<Tag[] | null>(null);
  const [tagsLoading, setTagsLoading] = useState(false);

  const labelEmb = useRef<Float32Array[] | null>(null);
  const uploadCounter = useRef(0);

  // ---- load artifacts -----------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const [manifest, emb, ev] = await Promise.all([
          fetch(`${BASE}gallery/manifest.json`).then((r) => r.json() as Promise<Manifest>),
          fetch(`${BASE}gallery/embeddings.json`).then((r) => r.json() as Promise<EmbeddingsFile>),
          fetch(`${BASE}gallery/eval.json`).then((r) => r.json() as Promise<EvalFile>),
        ]);
        const embById = new Map(emb.embeddings.map((e) => [e.id, e.v]));
        const built: Photo[] = manifest.items.map((it) => ({
          id: it.id,
          src: `${BASE}${it.file}`,
          category: it.category,
          title: it.title,
          creator: it.creator,
          license: it.license,
          licenseUrl: it.licenseUrl,
          source: it.source,
          isUpload: false,
          embedding: new Float32Array(embById.get(it.id) ?? []),
        }));
        setPhotos(built);
        setEvalData(ev);
      } catch (e) {
        setLoadError(String(e));
      }
    })();
    return onProgress(setProgress);
  }, []);

  // ---- search -------------------------------------------------------------
  const runSearch = async (q: string) => {
    setSearchBusy(true);
    try {
      const emb = await embedText(q);
      setQueryEmbedding(emb);
      setResults(rank(emb, photos));
      setActiveLabel(`“${q}”`);
    } catch (e) {
      setLoadError(String(e));
    } finally {
      setSearchBusy(false);
    }
  };

  const runFindSimilar = (photo: Photo) => {
    setSelectedId(undefined);
    setQueryEmbedding(photo.embedding);
    setResults(findSimilar(photo, photos));
    setActiveLabel(photo.isUpload ? "your image" : `“${photo.title}”`);
  };

  const clearSearch = () => {
    setResults(null);
    setQueryEmbedding(null);
    setActiveLabel("");
  };

  // ---- uploads ------------------------------------------------------------
  const onFiles = async (files: File[]) => {
    setUploadBusy(true);
    try {
      const added: Photo[] = [];
      for (const file of files) {
        const url = URL.createObjectURL(file);
        const embedding = await embedImageUrl(url);
        added.push({
          id: -(++uploadCounter.current),
          src: url,
          category: "upload",
          title: file.name,
          isUpload: true,
          embedding,
        });
      }
      const next = [...added, ...photos];
      setPhotos(next);
      if (queryEmbedding) setResults(rank(queryEmbedding, next));
    } catch (e) {
      setLoadError(String(e));
    } finally {
      setUploadBusy(false);
    }
  };

  // ---- zero-shot tags for the selected image ------------------------------
  const selected = useMemo(
    () => photos.find((p) => p.id === selectedId),
    [photos, selectedId],
  );

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    (async () => {
      setTags(null);
      setTagsLoading(true);
      try {
        if (!labelEmb.current) {
          labelEmb.current = await embedTexts(TAG_VOCAB.map((l) => `a photo of ${l}`));
        }
        const sims = labelEmb.current.map((le) => cosine(selected.embedding, le));
        const TEMP = 25; // softmax temperature for a readable tag distribution
        const exps = sims.map((s) => Math.exp(s * TEMP));
        const sum = exps.reduce((a, b) => a + b, 0);
        const scored: Tag[] = TAG_VOCAB.map((label, i) => ({ label, score: exps[i] / sum }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 8);
        if (!cancelled) setTags(scored);
      } finally {
        if (!cancelled) setTagsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  // ---- render -------------------------------------------------------------
  if (loadError && photos.length === 0) {
    return (
      <div className="app loading">
        <div>
          <p>Couldn't load the gallery artifacts.</p>
          <p style={{ color: "var(--faint)", fontSize: 13 }}>
            Run the tooling in <code>/scripts</code> to generate them. ({loadError})
          </p>
        </div>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="app loading">
        <div>
          <div className="spinner" />
          Loading gallery…
        </div>
      </div>
    );
  }

  const active = results !== null;
  const items: Scored[] = active
    ? results!
    : photos.map((p) => ({ photo: p, score: 0 }));

  const loadingModel =
    progress && progress.state === "loading" ? progress : null;

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="logo">🔮</div>
          <div>
            <h1>Iris</h1>
            <p>Neural photo search</p>
          </div>
        </div>
      </header>

      <section className="hero">
        <h2>
          Find any photo by <span className="g">describing it</span>.
        </h2>
        <p>
          Search {photos.filter((p) => !p.isUpload).length} demo photos with natural language,
          or add your own.
        </p>
      </section>

      <SearchBar onSearch={runSearch} busy={searchBusy} />

      {loadingModel && (
        <div className="searchwrap" style={{ marginTop: 16 }}>
          <div className="card">
            <div className="sub" style={{ marginBottom: 8 }}>{loadingModel.label}</div>
            <div className="loadbar">
              <div className="fill" style={{ width: `${Math.max(4, loadingModel.pct * 100)}%` }} />
            </div>
            <div className="attrib" style={{ marginTop: 8 }}>
              First run downloads the {loadingModel.tower} model (~cached afterwards).
            </div>
          </div>
        </div>
      )}

      <div className="section-title" style={{ marginTop: 30 }}>
        {active ? (
          <>
            Results for <span className="count">{activeLabel}</span>
            <button className="suggest" onClick={clearSearch} style={{ marginLeft: "auto" }}>
              ✕ clear
            </button>
          </>
        ) : (
          <>
            Demo gallery <span className="count">· {photos.length} photos · click any image</span>
          </>
        )}
      </div>

      <div className="grid two-col">
        <div>
          <PhotoGrid
            items={items}
            active={active}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, position: "sticky", top: 16 }}>
          <div className="card">
            <h3>Add your own photos</h3>
            <p className="sub">Add images to include them in the search.</p>
            <UploadZone onFiles={onFiles} busy={uploadBusy} />
          </div>

          <div className="card">
            <h3>Embedding galaxy</h3>
            <p className="sub">
              512-d CLIP vectors projected to 2-D with PCA. Semantically similar photos cluster;
              your query lands where it belongs.
            </p>
            <Galaxy
              photos={photos}
              queryEmbedding={queryEmbedding}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>

          {evalData && <QualityPanel evalData={evalData} />}
        </div>
      </div>

      {selected && (
        <PhotoModal
          photo={selected}
          tags={tags}
          tagsLoading={tagsLoading}
          onClose={() => setSelectedId(undefined)}
          onFindSimilar={runFindSimilar}
        />
      )}

      <footer className="footer">
        <p>Demo images sourced via Openverse. Per-image credits appear on each photo.</p>
      </footer>
    </div>
  );
}
