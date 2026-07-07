import type { Photo, Tag } from "../types";

interface Props {
  photo: Photo;
  tags: Tag[] | null;
  tagsLoading: boolean;
  onClose: () => void;
  onFindSimilar: (photo: Photo) => void;
}

export default function PhotoModal({ photo, tags, tagsLoading, onClose, onFindSimilar }: Props) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose}>
          ✕
        </button>
        <img className="big" src={photo.src} alt={photo.title} />

        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <button className="go" style={{ borderRadius: 10 }} onClick={() => onFindSimilar(photo)}>
            ✨ Find visually similar
          </button>
        </div>

        <h3 style={{ margin: "0 0 8px" }}>Zero-shot tags</h3>
        <p className="sub" style={{ marginBottom: 12 }}>
          CLIP scored this image against an open vocabulary — no training on these labels.
        </p>
        {tagsLoading && <div className="sub">Scoring against vocabulary…</div>}
        {tags &&
          tags.map((t) => (
            <div className="tagrow" key={t.label}>
              <div className="tn">{t.label}</div>
              <div className="tt">
                <div className="tf" style={{ width: `${Math.max(3, t.score * 100)}%` }} />
              </div>
              <div className="tv">{(t.score * 100).toFixed(0)}%</div>
            </div>
          ))}

        {!photo.isUpload && (
          <div className="attrib" style={{ marginTop: 16 }}>
            “{photo.title}” by {photo.creator} ·{" "}
            {photo.licenseUrl ? (
              <a href={photo.licenseUrl} target="_blank" rel="noreferrer">
                {photo.license}
              </a>
            ) : (
              photo.license
            )}{" "}
            ·{" "}
            {photo.source && (
              <a href={photo.source} target="_blank" rel="noreferrer">
                source
              </a>
            )}{" "}
            (via Openverse)
          </div>
        )}
        {photo.isUpload && (
          <div className="attrib" style={{ marginTop: 16 }}>
            Uploaded image
          </div>
        )}
      </div>
    </div>
  );
}
