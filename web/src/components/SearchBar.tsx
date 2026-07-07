import { useState } from "react";

interface Props {
  onSearch: (q: string) => void;
  busy: boolean;
}

const SUGGESTIONS = [
  "a dog playing outside",
  "something to drink",
  "city lights at night",
  "snow on the mountains",
  "a red vehicle",
  "the ocean",
];

export default function SearchBar({ onSearch, busy }: Props) {
  const [q, setQ] = useState("");
  const submit = () => {
    if (q.trim()) onSearch(q.trim());
  };
  return (
    <div className="searchwrap">
      <div className="searchbar">
        <span className="ico">🔍</span>
        <input
          value={q}
          placeholder="Describe what you're looking for…"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button className="go" onClick={submit} disabled={busy || !q.trim()}>
          {busy ? "Searching…" : "Search"}
        </button>
      </div>
      <div className="suggests">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            className="suggest"
            onClick={() => {
              setQ(s);
              onSearch(s);
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
