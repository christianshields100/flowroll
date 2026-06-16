"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { updateAvatarUrl } from "./actions";

const MAX_BYTES = 5 * 1024 * 1024;

// "Change photo" control on your own profile. Uploads straight to the avatars
// bucket (storage RLS restricts you to your own folder), then records the URL.
export function AvatarUploader({ uid }: { uid: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Pick an image file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Keep it under 5 MB.");
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${uid}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      // Cache-bust so the new photo replaces the old one immediately.
      const url = `${data.publicUrl}?t=${Date.now()}`;
      await updateAvatarUrl(url);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPick}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="font-mono text-[10px] uppercase tracking-dojo px-3 py-1.5 rounded-sm border border-paper-line text-ink-dim hover:border-accent hover:text-accent transition disabled:opacity-50"
      >
        {busy ? "Uploading…" : "Change photo"}
      </button>
      {error && <p className="mt-1 text-xs text-accent">{error}</p>}
    </div>
  );
}
