// Technique taxonomy — a keyword classifier over free-text "drilled" fields
// and submission names, so the app can see WHAT someone works on (guard,
// passing, escapes…) without asking them to tag anything. Deterministic and
// reviewable; unknown text simply lands in no category.

export type Category =
  | "guard"
  | "passing"
  | "sweeps"
  | "escapes"
  | "takedowns"
  | "back"
  | "top_control"
  | "leg_locks"
  | "submissions";

export const CATEGORY_LABEL: Record<Category, string> = {
  guard: "Guard & retention",
  passing: "Guard passing",
  sweeps: "Sweeps",
  escapes: "Escapes & defense",
  takedowns: "Takedowns & wrestling",
  back: "Back attacks",
  top_control: "Top control & pressure",
  leg_locks: "Leg locks",
  submissions: "Submissions",
};

const RULES: [Category, RegExp][] = [
  ["leg_locks", /\b(heel\s?hook|ankle\s?lock|knee\s?bar|toe\s?hold|leg\s?lock|ashi|saddle|411|inside\s?sankaku|estima|calf\s?slicer|straight\s?ankle)\b/i],
  ["back", /\b(back\s?(take|attack|control|mount)|rear\s?naked|rnc|bow\s?and\s?arrow|seatbelt|hooks|chair\s?sit|crucifix|body\s?triangle)\b/i],
  ["takedowns", /\b(takedown|wrestl|single\s?leg|double\s?leg|snap\s?down|arm\s?drag|foot\s?sweep|judo|throw|uchi\s?mata|osoto|ippon|guard\s?pull|ankle\s?pick|blast\s?double|sprawl|front\s?headlock)\b/i],
  ["passing", /\b(pass(ing|es|er)?|knee\s?(cut|slice)|toreando|torreando|leg\s?drag|smash\s?pass|over[-\s]?under|stack|long\s?step|x[-\s]?pass|body\s?lock|headquarters|hq)\b/i],
  ["escapes", /\b(escape|defen[cs]e|survival|shrimp|hip\s?escape|frame|framing|bridge|elbow\s?knee|get\s?out|turtle|recover|posture)\b/i],
  ["sweeps", /\b(sweep|reversal|scissor|hip\s?bump|flower|pendulum|tripod|sickle|kiss\s?of\s?the\s?dragon)\b/i],
  ["guard", /\b(guard|closed|open|butterfly|half|de\s?la\s?riva|dlr|rdlr|spider|lasso|lapel|worm|x[-\s]?guard|single\s?leg\s?x|slx|k[-\s]?guard|z[-\s]?guard|retention|rubber|collar\s?sleeve|inversion|invert|berimbolo)\b/i],
  ["top_control", /\b(mount|side\s?control|knee\s?on\s?belly|kob|north\s?south|pressure|crossface|underhook|top\s?position|transition)\b/i],
  ["submissions", /\b(armbar|arm\s?bar|triangle|kimura|americana|guillotine|ezekiel|d'?arce|darce|anaconda|omoplata|choke|strangle|loop|baseball|paper\s?cutter|wrist\s?lock|submission|finish|tap)\b/i],
];

/** Categories mentioned in a piece of text (may be several, may be none). */
export function classifyText(text: string | null | undefined): Category[] {
  if (!text) return [];
  const found: Category[] = [];
  for (const [cat, re] of RULES) if (re.test(text)) found.push(cat);
  return found;
}

/** Tally how many sessions touched each category via drilled text. */
export function categoryCoverage(
  drilledTexts: (string | null | undefined)[],
): Record<Category, number> {
  const out = Object.fromEntries(
    Object.keys(CATEGORY_LABEL).map((k) => [k, 0]),
  ) as Record<Category, number>;
  for (const t of drilledTexts) {
    Array.from(new Set(classifyText(t))).forEach((c) => {
      out[c] += 1;
    });
  }
  return out;
}
