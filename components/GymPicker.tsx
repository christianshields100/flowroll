"use client";

// Single-select gym autocomplete. Type → debounced /api/gyms/search → a list
// of OpenStreetMap suggestions drops in below the box; pick one and we keep its
// place_id (the standardizing key) plus its name. Mirrors the submissions UX.
// There's always a "Use '<typed>'" option so gyms not on the map can be saved
// as free text (no place_id → not standardized, but still recorded).
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
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(
    null,
  );
  const askedGeo = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Ask the browser for location once so we can rank nearby gyms first. Purely
  // best-effort: if the user declines or it's unavailable, search runs unbiased.
  function ensureGeo() {
    if (askedGeo.current || !navigator?.geolocation) return;
    askedGeo.current = true;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600_000 },
    );
  }

  // Debounced search (min 3 chars). Re-runs when coords arrive so the current
  // query gets re-ranked by proximity.
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
        const loc = coords ? `&lat=${coords.lat}&lon=${coords.lon}` : "";
        const res = await fetch(
          `/api/gyms/search?q=${encodeURIComponent(q)}${loc}`,
        );
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
  }, [query, coords]);

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

  const typed = query.trim();
  // If what they typed isn't already an exact suggestion, always offer to save
  // it as-is — lots of academies (especially small ones) just aren't on the map.
  const exactMatch = results.some(
    (s) => s.name.toLowerCase() === typed.toLowerCase(),
  );
  const showDropdown = open && typed.length >= 3;

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
            onFocus={() => {
              setOpen(true);
              ensureGeo();
            }}
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
              {coords && results.length > 0 && (
                <li className="px-3 pt-2 pb-1 font-mono text-[9px] uppercase tracking-dojo text-ink-mute">
                  Sorted by distance
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
              {/* Can't-find-it fallback: save the typed name verbatim. */}
              {!exactMatch && !unavailable && (
                <li className={results.length > 0 ? "border-t border-paper-line" : ""}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      commitFreeText();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-paper-ink transition"
                  >
                    <span className="block text-sm text-ink">
                      Use &ldquo;{typed}&rdquo;
                    </span>
                    <span className="block text-xs text-ink-mute">
                      Add your gym as-is — it isn&apos;t on the map yet
                    </span>
                  </button>
                </li>
              )}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
