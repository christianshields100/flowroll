// Session media helpers, shared by the uploader and the session cards.
// Since v12 the session-media bucket is PRIVATE: sessions store bare object
// paths ("{uid}/{file}") and the app serves them via short-lived signed URLs.

const VIDEO_EXTS = ["mp4", "mov", "webm", "m4v", "ogv"];

export function isVideoUrl(url: string): boolean {
  const path = url.split("?")[0].toLowerCase();
  const ext = path.split(".").pop() ?? "";
  return VIDEO_EXTS.includes(ext);
}

export const MAX_MEDIA_PER_SESSION = 6;

// One hour — long enough for a browsing session, short enough that a leaked
// URL goes stale quickly.
export const MEDIA_SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Normalize a stored media reference to a bare bucket path. Accepts bare
 * paths (current format) and legacy full public URLs (pre-v12 rows or
 * clients), rejecting anything else.
 */
export function toMediaPath(ref: string): string | null {
  let path = ref.trim();
  const marker = "/storage/v1/object/public/session-media/";
  const i = path.indexOf(marker);
  if (i >= 0) path = path.slice(i + marker.length);
  path = path.split("?")[0];
  // {uuid}/{filename} — nothing else gets into the column.
  if (!/^[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/.test(path)) return null;
  return path;
}

/** True when a submitted reference points into our own session-media bucket. */
export function isSessionMediaRef(ref: string): boolean {
  return toMediaPath(ref) !== null;
}
