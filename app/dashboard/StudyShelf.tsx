import { videoUrl, type StudyVideo } from "@/lib/youtube";

// One shelf of study videos (e.g. "Escape your nemesis: armbar").
// Pure presentation; the dashboard picks the topics from the scorecard.
export function StudyShelf({
  shelves,
}: {
  shelves: { tag: string; title: string; videos: StudyVideo[] }[];
}) {
  const nonEmpty = shelves.filter((s) => s.videos.length > 0);
  if (!nonEmpty.length) return null;

  return (
    <section>
      <p className="font-mono text-[10px] uppercase tracking-dojo text-accent">
        Study
      </p>
      <h2 className="mt-1 font-display text-2xl tracking-tightish">
        Watch &amp; learn
      </h2>
      <p className="mt-1 text-sm text-ink-mute">
        Picked from your scorecard — what catches you, and what you finish.
      </p>

      <div className="mt-5 space-y-6">
        {nonEmpty.map((shelf) => (
          <div key={shelf.title}>
            <p className="font-mono text-[11px] text-ink-dim">
              <span className="uppercase tracking-dojo text-ink-mute">
                {shelf.tag}
              </span>{" "}
              {shelf.title}
            </p>
            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3">
              {shelf.videos.map((v) => (
                <a
                  key={v.videoId}
                  href={videoUrl(v)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-sm bg-paper-raised border border-paper-line overflow-hidden hover:border-accent transition"
                >
                  {v.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={v.thumb}
                      alt=""
                      loading="lazy"
                      className="w-full aspect-video object-cover"
                    />
                  ) : (
                    <div className="w-full aspect-video bg-paper" />
                  )}
                  <div className="p-2.5">
                    <p className="text-xs text-ink leading-snug line-clamp-2 group-hover:text-accent transition">
                      {v.title}
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-ink-mute truncate">
                      {v.channel}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
