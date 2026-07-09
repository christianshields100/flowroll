// Photo/video grid on a session card (feed + profile). Server-safe markup —
// native <video controls>, no client JS needed.
import { isVideoUrl } from "@/lib/media";

export function SessionMedia({ urls }: { urls?: string[] }) {
  if (!urls?.length) return null;
  const single = urls.length === 1;
  return (
    <div
      className={
        single ? "mt-3" : "mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2"
      }
    >
      {urls.map((url) =>
        isVideoUrl(url) ? (
          <video
            key={url}
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
            key={url}
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
