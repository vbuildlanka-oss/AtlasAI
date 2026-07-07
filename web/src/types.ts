// Types mirror the artifacts produced by the offline tooling in /scripts.

export interface ManifestItem {
  id: number;
  file: string; // path relative to /public (e.g. "gallery/img/000.jpg")
  category: string;
  title: string;
  creator: string;
  license: string;
  licenseUrl: string;
  source: string;
  provider: string;
}

export interface Manifest {
  builtAt: string;
  count: number;
  items: ManifestItem[];
}

export interface EmbeddingsFile {
  model: string;
  dtype: string;
  dim: number;
  normalized: boolean;
  count: number;
  embeddings: { id: number; v: number[] }[];
}

export interface EvalFile {
  model: string;
  evaluatedAt: string;
  aggregate: {
    queries: number;
    gallerySize: number;
    mAP: number;
    mrr: number;
    pAt: Record<string, number>;
  };
  perQuery: {
    query: string;
    category: string;
    nRelevant: number;
    pAt: Record<string, number>;
    rr: number;
    ap: number;
    topIds: number[];
  }[];
}

// Runtime image (gallery item OR user upload) with its embedding attached.
export interface Photo {
  id: number; // negative ids for user uploads
  src: string; // resolvable URL
  category: string; // "upload" for user images
  title: string;
  creator?: string;
  license?: string;
  licenseUrl?: string;
  source?: string;
  isUpload: boolean;
  embedding: Float32Array; // L2-normalised, 512-dim
}

export interface Scored {
  photo: Photo;
  score: number; // cosine similarity in [-1, 1]
}

export interface Tag {
  label: string;
  score: number;
}
