"use client";

// Chip-style multi-value input with autocomplete. Values are exposed to the
// surrounding <form> through a hidden input as a comma-separated string, so
// the existing server actions keep their parseSubs() contract.
import { useEffect, useMemo, useRef, useState } from "react";

export function TagInput({
  name,
  suggestions,
  placeholder,
  initial = [],
  accent = false,
}: {
  name: string;
  suggestions: string[];
  placeholder?: string;
  initial?: string[];
  accent?: boolean;
}) {
  const [tags, setTags] = useState<string[]>(initial);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const tagKeys = useMemo(
    () => new Set(tags.map((t) => t.toLowerCase())),
    [tags],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return suggestions
      .filter((s) => s.toLowerCase().includes(q) && !tagKeys.has(s.toLowerCase()))
      .slice(0, 6);
  }, [query, suggestions, tagKeys]);

  useEffect(() => setHighlight(0), [matches.length, query]);

  // Close the dropdown on outside click.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function add(raw: string) {
    const value = raw.trim().replace(/,+$/, "").trim();
    if (!value || tagKeys.has(value.toLowerCase())) {
      setQuery("");
      return;
    }
    // If the typed value matches a suggestion case-insensitively, adopt the
    // suggestion's spelling — this is the normalization step.
    const canonical = suggestions.find(
      (s) => s.toLowerCase() === value.toLowerCase(),
    );
    setTags((cur) => [...cur, canonical ?? value]);
    setQuery("");
    setOpen(false);
  }

  function remove(idx: number) {
    setTags((cur) => cur.filter((_, i) => i !== idx));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (open && matches[highlight]) add(matches[highlight]);
      else if (query.trim()) add(query);
    } else if (e.key === "ArrowDown" && matches.length) {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (h + 1) % matches.length);
    } else if (e.key === "ArrowUp" && matches.length) {
      e.preventDefault();
      setHighlight((h) => (h - 1 + matches.length) % matches.length);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && !query && tags.length) {
      remove(tags.length - 1);
    }
  }

  const chipCls = accent
    ? "bg-accent/10 text-accent border border-accent/30"
    : "bg-belt-black/10 text-belt-black border border-belt-black/30";

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={name} value={tags.join(", ")} />
      <div className="w-full bg-paper border border-paper-line rounded-sm px-2 py-1.5 flex flex-wrap items-center gap-1.5 focus-within:border-accent transition">
        {tags.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className={`font-mono text-[10px] uppercase tracking-dojo pl-2 pr-1 py-0.5 rounded-sm inline-flex items-center gap-1 ${chipCls}`}
          >
            {tag}
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={`Remove ${tag}`}
              className="px-0.5 hover:opacity-60 transition"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Commit whatever was typed when leaving the field.
            if (query.trim()) add(query);
          }}
          onKeyDown={onKeyDown}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[8rem] bg-transparent px-1 py-1 text-ink placeholder:text-ink-mute focus:outline-none"
        />
      </div>

      {open && matches.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-paper border border-paper-line rounded-sm shadow-paper max-h-48 overflow-y-auto">
          {matches.map((m, i) => (
            <li key={m}>
              <button
                type="button"
                // onMouseDown so it fires before the input's onBlur commit.
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(m);
                }}
                className={`w-full text-left px-3 py-2 text-sm transition ${
                  i === highlight
                    ? "bg-paper-ink text-ink"
                    : "text-ink-dim hover:bg-paper-ink hover:text-ink"
                }`}
              >
                {m}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
