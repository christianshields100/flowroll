// Notification rendering — one place that turns a row into a sentence and a
// link, shared by the bell dropdown (client) and anything server-side.

export type NotificationRow = {
  id: string;
  type:
    | "follow_request"
    | "follow_accepted"
    | "new_follower"
    | "reaction"
    | "comment"
    | "partner_logged"
    | "milestone"
    | "promotion"
    | "recap";
  actor_id: string | null;
  session_id: string | null;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

const ROMAN = ["", "I", "II", "III", "IV"];

export function describeNotification(
  n: NotificationRow,
  meId: string,
): { text: string; href: string } {
  const d = n.data ?? {};
  const actor = (d.actor_name as string) || "Someone";
  switch (n.type) {
    case "follow_request":
      return { text: `${actor} asked to follow you`, href: "/feed" };
    case "follow_accepted":
      return {
        text: `${actor} accepted your follow request`,
        href: n.actor_id ? `/u/${n.actor_id}` : "/feed",
      };
    case "new_follower":
      return {
        text: `${actor} started following you`,
        href: n.actor_id ? `/u/${n.actor_id}` : "/feed",
      };
    case "reaction": {
      const actors = Array.isArray(d.actors) ? (d.actors as string[]).length : 1;
      const others = Math.max(0, actors - 1);
      return {
        text:
          others > 0
            ? `${actor} and ${others} other${others === 1 ? "" : "s"} reacted to your session`
            : `${actor} reacted ${typeof d.emoji === "string" ? d.emoji + " " : ""}to your session`,
        href: `/u/${meId}`,
      };
    }
    case "comment": {
      const snippet = typeof d.snippet === "string" ? d.snippet : "";
      return {
        text: d.reply
          ? `${actor} also commented on a session you're in: “${snippet}”`
          : `${actor} commented: “${snippet}”`,
        href: d.reply ? "/feed" : `/u/${meId}`,
      };
    }
    case "partner_logged": {
      const date = typeof d.trained_on === "string" ? d.trained_on : "";
      const pretty = date
        ? new Date(date + "T00:00:00").toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })
        : "";
      return {
        text: `${actor} logged a session with you${pretty ? ` on ${pretty}` : ""} — log yours?`,
        href: date ? `/log?d=${date}` : "/log",
      };
    }
    case "milestone": {
      const mark = Number(d.mark) || 0;
      return {
        text:
          d.kind === "hours"
            ? `${mark} hours on the mat. A milestone.`
            : mark === 1
              ? "First session logged."
              : `Session number ${mark}. A milestone.`,
        href: "/dashboard",
      };
    }
    case "promotion": {
      const belt = typeof d.belt === "string" ? d.belt : "";
      const stripes = Number(d.stripes) || 0;
      const rank = belt
        ? `${belt.charAt(0).toUpperCase() + belt.slice(1)} belt${stripes ? " " + ROMAN[stripes] : ""}`
        : "a new rank";
      return { text: `Promoted to ${rank}. Congratulations.`, href: "/dashboard" };
    }
    case "recap":
      return { text: "Your week on the mat is ready.", href: "/dashboard" };
    default:
      return { text: "Something happened.", href: "/dashboard" };
  }
}

export function relativeTime(iso: string, now: Date = new Date()): string {
  const s = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
