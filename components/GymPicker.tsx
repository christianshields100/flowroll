"use client";

// Single-select gym autocomplete. Type → debounced /api/gyms/search → a list
// of Google Places suggestions drops in below the box; pick one and we keep its
// place_id (the standardizing key) plus its name. Mirrors the submissions UX.
// If search isn't configured, you can still save a free-text gym name.
import { useEffect, useRef, useState } from "react";

type Suggestion = { placeId: string; name: string; address: string };

const inputCls =
  "w-full bg-paper border border-paper-line rounded-sm px-3 py-2.5 text-ink placeholder:text-ink-mute focus:outline-none focus:border-accent transition";

export function GymPicker({
  nameField = "gym",
  placeIdField = "gym_place_id",
  initialName = "",
  initialPlaceId = "",
  placeholder = "Search your gym…",
}: {
  nameField?: string;
  placeIdField?: string;
  initialName?: string;
  initialPlaceId?: string;
  placeholder?: string;
}) {
  const [selected, setSelected] = useState<{
    name: string;
    placeId: string;
  } | null>(initialName ? { name: initialName, placeId: initialPlaceId } : null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  // Debounced search (min 3 chars).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/gyms/search?q=${encodeURIComponent(q)}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 503) {
          setUnavailable(true);
          setResults([]);
        } else {
          setUnavailable(false);
          setResults((data.suggestions ?? []) as Suggestion[]);
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  useEffect(() => setHighlight(0), [results.length]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function pick(s: Suggestion) {
    setSelected({ name: s.name, placeId: s.placeId });
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  // Save whatever was typed as a plain name (no place_id → not standardized).
  function commitFreeText() {
    const v = query.trim();
    if (!v) return;
    setSelected({ name: v, placeId: "" });
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (open && results[highlight]) pick(results[highlight]);
      else commitFreeText();
    } else if (e.key === "ArrowDown" && results.length) {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (h + 1) % results.length);
    } else if (e.key === "ArrowUp" && results.length) {
      e.preventDefault();
      setHighlight((h) => (h - 1 + results.length) % results.length);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showDropdown =
    open &&
    query.trim().length >= 3 &&
    (results.length > 0 || loading || unavailable);

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={nameField} value={selected?.name ?? ""} />
      <input
        type="hidden"
        name={placeIdField}
        value={selected?.placeId ?? ""}
      />

      {selected ? (
        <div className="flex items-center justify-between gap-2 w-full bg-paper border border-paper-line rounded-sm px-3 py-2.5">
          <span className="flex items-center gap-2 min-w-0">
            <span className="text-ink truncate">{selected.name}</span>
            {selected.placeId && (
              <span className="font-mono text-[9px] uppercase tracking-dojo text-ink-mute border border-paper-line rounded-sm px-1.5 py-0.5 flex-shrink-0">
                verified
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setQuery("");
            }}
            className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute hover:text-accent transition flex-shrink-0"
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className={inputCls}
          />
          {showDropdown && (
            <ul className="absolute z-10 mt-1 w-full bg-paper border border-paper-line rounded-sm shadow-paper max-h-60 overflow-y-auto">
              {loading && results.length === 0 && (
                <li className="px-3 py-2 text-sm text-ink-mute font-mono">
                  Searching…
                </li>
              )}
              {unavailable && (
                <li className="px-3 py-2 text-xs text-ink-mute leading-relaxed">
                  Gym search isn&apos;t set up yet — press Enter to save
                  &ldquo;{query.trim()}&rdquo; as text.
                </li>
              )}
              {results.map((s, i) => (
                <li key={s.placeId}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(s);
                    }}
                    className={`w-full text-left px-3 py-2 transition ${
                      i === highlight ? "bg-paper-ink" : "hover:bg-paper-ink"
                    }`}
                  >
                    <span className="block text-sm text-ink">{s.name}</span>
                    {s.address && (
                      <span className="block text-xs text-ink-mute">
                        {s.address}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
