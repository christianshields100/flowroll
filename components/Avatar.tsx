// Profile avatar: uploaded photo when present, else a monogram fallback.
import type { Belt } from "@/components/SessionCard";

const SIZES = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-11 w-11 text-sm",
  lg: "h-20 w-20 text-2xl",
} as const;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name.trim().slice(0, 2) || "?").toUpperCase();
}

export function Avatar(props: {
  url?: string | null;
  name: string;
  size?: keyof typeof SIZES;
  // belt is accepted for future tinting but the monogram stays on-brand red.
  belt?: Belt;
}) {
  const { url, name, size = "md" } = props;
  const dims = SIZES[size];
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        className={`${dims} rounded-full object-cover border border-paper-line flex-shrink-0`}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`${dims} rounded-full bg-accent text-paper flex items-center justify-center font-display tracking-tightish flex-shrink-0`}
    >
      {initialsOf(name)}
    </span>
  );
}
