"use client";

// Photo/video attachments for the session form. Files upload straight to the
// public session-media bucket (storage RLS limits writes to your own
// {uid}/ folder); the resulting URLs ride along in a hidden input that the
// server action saves onto the session row.
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isVideoUrl, MAX_MEDIA_PER_SESSION } from "@/lib/media";

const MAX_BYTES = 50 * 1024 * 1024; // matches the bucket's file_size_limit

export function MediaUploader({
  uid,
  initialUrls = [],
  name = "media_urls",
}: {
  uid: string;
  initialUrls?: string[];
  name?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [urls, setUrls] = useState<string[]>(initialUrls);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;

    if (urls.length + files.length > MAX_MEDIA_PER_SESSION) {
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
      const uploaded: string[] = [];
      for (const f of files) {
        const ext = (f.name.split(".").pop() || "bin").toLowerCase();
        const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("session-media")
          .upload(path, f, { contentType: f.type });
        if (upErr) throw upErr;
        const { data } = supabase.storage
          .from("session-media")
          .getPublicUrl(path);
        uploaded.push(data.publicUrl);
      }
      setUrls((u) => [...u, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  function remove(url: string) {
    setUrls((u) => u.filter((x) => x !== url));
    // Best-effort storage cleanup; the row simply won't reference it either way.
    const marker = "/storage/v1/object/public/session-media/";
    const i = url.indexOf(marker);
    if (i >= 0) {
      const path = url.slice(i + marker.length).split("?")[0];
      createClient().storage.from("session-media").remove([path]);
    }
  }

  return (
    <div>
      <input type="hidden" name={name} value={urls.join("\n")} />
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={onPick}
      />

      {urls.length > 0 && (
        <div className="mb-3 grid grid-cols-3 gap-2">
          {urls.map((url) => (
            <div key={url} className="relative group">
              {isVideoUrl(url) ? (
                <video
                  src={url}
                  className="h-24 w-full rounded-sm object-cover bg-paper-ink"
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={url}
                  alt=""
                  className="h-24 w-full rounded-sm object-cover bg-paper-ink"
                />
              )}
              <button
                type="button"
                onClick={() => remove(url)}
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
        disabled={busy || urls.length >= MAX_MEDIA_PER_SESSION}
        className="font-mono text-[10px] uppercase tracking-dojo px-3 py-1.5 rounded-sm border border-paper-line text-ink-dim hover:border-accent hover:text-accent transition disabled:opacity-50"
      >
        {busy ? "Uploading…" : "Add photos / video"}
      </button>
      {error && <p className="mt-1 text-xs text-accent">{error}</p>}
    </div>
  );
}
