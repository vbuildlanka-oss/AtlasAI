import { useRef, useState } from "react";

interface Props {
  onFiles: (files: File[]) => void;
  busy: boolean;
}

export default function UploadZone({ onFiles, busy }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const handle = (list: FileList | null) => {
    if (!list) return;
    const files = Array.from(list).filter((f) => f.type.startsWith("image/"));
    if (files.length) onFiles(files);
  };

  return (
    <div
      className={`drop ${over ? "over" : ""}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        handle(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => handle(e.target.files)}
      />
      {busy ? (
        <>⏳ Embedding your images with CLIP…</>
      ) : (
        <>
          <strong style={{ color: "var(--text)" }}>Drop your own photos</strong> or click to
          browse.
          <br />
          They're embedded locally and never leave your device.
        </>
      )}
    </div>
  );
}
