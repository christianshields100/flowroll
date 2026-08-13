"use client";

// Photo/video attachments for the session form. Files upload straight to the
// PRIVATE session-media bucket (storage RLS limits writes to your own
// {uid}/ folder); bare object paths ride along in a hidden input that the
// server action saves onto the session row. Previews use short-lived signed
// URLs minted client-side (the authenticated-read policy allows it).
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  isVideoUrl,
  MAX_MEDIA_PER_SESSION,
  MEDIA_SIGNED_URL_TTL_SECONDS,
  toMediaPath,
} from "@/lib/media";

const MAX_BYTES = 50 * 1024 * 1024; // matches the bucket's file_size_limit

type Item = { path: string; previewUrl: string };

export function MediaUploader({
  uid,
  initialUrls = [],
  name = "media_urls",
}: {
  uid: string;
  // Stored refs from the session row — bare paths (or legacy public URLs).
  initialUrls?: string[];
  name?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sign previews for pre-existing attachments (edit mode).
  useEffect(() => {
    const paths = initialUrls
      .map(toMediaPath)
      .filter((p): p is string => p !== null);
    if (!paths.length) return;
    let cancelled = false;
    (async () => {
      const { data } = await createClient()
        .storage.from("session-media")
        .createSignedUrls(paths, MEDIA_SIGNED_URL_TTL_SECONDS);
      if (cancelled || !data) return;
      setItems(
        data
          .map((d, i) => ({ path: paths[i], previewUrl: d.signedUrl ?? "" }))
          .filter((x) => x.previewUrl),
      );
    })();
    return () => {
      cancelled = true;
    };
    // initialUrls is stable for the life of the form (key'd remounts).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;

    if (items.length + files.length > MAX_MEDIA_PER_SESSION) {
      setError(`Max ${MAX_MEDIA_PER_SESSION} files per session.`);
      return;
    }
    for (const f of files) {
      if (!f.type.startsWith("image/") && !f.type.startsWith("video/")) {
        setError("Photos and videos only.");
        return;
      }
      if (f.size > MAX_BYTES) {
        setError("Keep each file under 50 MB.");
        return;
      }
    }

    setError(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const uploaded: Item[] = [];
      for (const f of files) {
        const ext = (f.name.split(".").pop() || "bin").toLowerCase();
        const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("session-media")
          .upload(path, f, { contentType: f.type });
        if (upErr) throw upErr;
        const { data } = await supabase.storage
          .from("session-media")
          .createSignedUrl(path, MEDIA_SIGNED_URL_TTL_SECONDS);
        uploaded.push({ path, previewUrl: data?.signedUrl ?? "" });
      }
      setItems((u) => [...u, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  function remove(path: string) {
    setItems((u) => u.filter((x) => x.path !== path));
    // Best-effort storage cleanup; the row simply won't reference it either way.
    createClient().storage.from("session-media").remove([path]);
  }

  return (
    <div>
      <input
        type="hidden"
        name={name}
        value={items.map((x) => x.path).join("\n")}
      />
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={onPick}
      />

      {items.length > 0 && (
        <div className="mb-3 grid grid-cols-3 gap-2">
          {items.map(({ path, previewUrl }) => (
            <div key={path} className="relative group">
              {isVideoUrl(path) ? (
                <video
                  src={previewUrl}
                  className="h-24 w-full rounded-sm object-cover bg-paper-ink"
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt=""
                  className="h-24 w-full rounded-sm object-cover bg-paper-ink"
                />
              )}
              <button
                type="button"
                onClick={() => remove(path)}
                aria-label="Remove"
                className="absolute top-1 right-1 h-5 w-5 rounded-sm bg-belt-black/80 text-paper text-xs leading-none opacity-0 group-hover:opacity-100 transition"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy || items.length >= MAX_MEDIA_PER_SESSION}
        className="text-[11px] uppercase tracking-dojo px-3 py-1.5 border border-paper-input text-ink-dim hover:border-ink hover:text-ink transition-colors disabled:opacity-50"
      >
        {busy ? "Uploading…" : "Add photos / video"}
      </button>
      {error && <p className="mt-1 text-xs text-accent">{error}</p>}
    </div>
  );
}
