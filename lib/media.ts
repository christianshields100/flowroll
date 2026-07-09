// Session media helpers, shared by the uploader and the session cards.

const VIDEO_EXTS = ["mp4", "mov", "webm", "m4v", "ogv"];

export function isVideoUrl(url: string): boolean {
  const path = url.split("?")[0].toLowerCase();
  const ext = path.split(".").pop() ?? "";
  return VIDEO_EXTS.includes(ext);
}

export const MAX_MEDIA_PER_SESSION = 6;

// Only accept URLs that live in our own public session-media bucket — keeps
// arbitrary external URLs out of the column.
export function isSessionMediaUrl(url: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return (
    !!base &&
    url.startsWith(`${base}/storage/v1/object/public/session-media/`)
  );
}
