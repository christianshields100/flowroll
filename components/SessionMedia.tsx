// Photo/video grid on a session card (feed + profile). Async server
// component: stored refs are bare paths into the PRIVATE session-media
// bucket, exchanged here for short-lived signed URLs. Legacy public URLs
// (pre-v12 rows) normalize to paths first.
import { createClient } from "@/lib/supabase/server";
import {
  isVideoUrl,
  MEDIA_SIGNED_URL_TTL_SECONDS,
  toMediaPath,
} from "@/lib/media";

export async function SessionMedia({ urls }: { urls?: string[] }) {
  const paths = (urls ?? [])
    .map(toMediaPath)
    .filter((p): p is string => p !== null);
  if (!paths.length) return null;

  const supabase = createClient();
  const { data } = await supabase.storage
    .from("session-media")
    .createSignedUrls(paths, MEDIA_SIGNED_URL_TTL_SECONDS);
  const items = (data ?? [])
    .map((d, i) => ({ url: d.signedUrl ?? "", path: paths[i], err: d.error }))
    .filter((d) => d.url && !d.err);
  if (!items.length) return null;

  const single = items.length === 1;
  return (
    <div
      className={
        single ? "mt-3" : "mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2"
      }
    >
      {items.map(({ url, path }) =>
        isVideoUrl(path) ? (
          <video
            key={path}
            src={url}
            controls
            playsInline
            preload="metadata"
            className={
              single
                ? "max-h-96 w-full rounded-sm bg-paper-ink object-contain"
                : "h-36 w-full rounded-sm bg-paper-ink object-cover"
            }
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={path}
            src={url}
            alt="Session photo"
            loading="lazy"
            className={
              single
                ? "max-h-96 w-full rounded-sm bg-paper-ink object-contain"
                : "h-36 w-full rounded-sm bg-paper-ink object-cover"
            }
          />
        ),
      )}
    </div>
  );
}
