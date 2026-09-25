import Link from "next/link";
import { INSIGHTS_MIN_SESSIONS, type Insight } from "@/lib/insights";

// "What's working — and what isn't": the insights engine's sentences, each
// with an explain-this link that hands the exact question to Coach.
export function InsightsReport({
  insights,
  sessionCount,
}: {
  insights: Insight[];
  sessionCount: number;
}) {
  if (sessionCount < INSIGHTS_MIN_SESSIONS) {
    const left = INSIGHTS_MIN_SESSIONS - sessionCount;
    return (
      <p className="text-sm italic text-ink-mute">
        Log {left} more session{left === 1 ? "" : "s"} to unlock your report —
        the app needs a little history before it starts drawing conclusions.
      </p>
    );
  }
  if (!insights.length) {
    return (
      <p className="text-sm italic text-ink-mute">
        Nothing stands out yet. Keep logging — patterns take a few weeks to
        show.
      </p>
    );
  }

  const mark = { good: "▲", watch: "●", info: "—" } as const;
  const tone = {
    good: "text-accent",
    watch: "text-ink",
    info: "text-ink-mute",
  } as const;

  return (
    <ul className="divide-y divide-paper-line">
      {insights.map((i) => (
        <li key={i.topic} className="py-3 flex items-start gap-3">
          <span
            aria-hidden
            className={`mt-[3px] w-4 shrink-0 text-[11px] ${tone[i.kind]}`}
          >
            {mark[i.kind]}
          </span>
          <span className="flex-1 text-sm text-ink leading-relaxed">
            {i.text}{" "}
            <Link
              href={`/chat?q=${encodeURIComponent(`Explain this insight from my dashboard and tell me what to do about it: "${i.text}"`)}`}
              className="whitespace-nowrap text-[11px] text-ink-mute hover:text-accent transition-colors"
            >
              ask Coach →
            </Link>
          </span>
        </li>
      ))}
    </ul>
  );
}
