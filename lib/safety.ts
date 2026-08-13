// Crisis detection for the Coach chat (compliance item 8). A deliberately
// simple, reviewable keyword layer that runs BEFORE the model call, so a
// crisis message is guaranteed the resource response even if the model
// would have missed it. Patterns are phrases, not bare words — "killing it
// on the mat" must not trigger.

const CRISIS_PATTERNS: RegExp[] = [
  /\bkill(?:ing)?\s+myself\b/i,
  /\bsuicid(?:e|al)\b/i,
  /\bend(?:ing)?\s+my\s+(?:own\s+)?life\b/i,
  /\btake\s+my\s+(?:own\s+)?life\b/i,
  /\bwant(?:ed)?\s+to\s+die\b/i,
  /\bwish\s+i\s+(?:was|were)\s+dead\b/i,
  /\bbetter\s+off\s+dead\b/i,
  /\bbetter\s+off\s+without\s+me\b/i,
  /\bhurt(?:ing)?\s+myself\b/i,
  /\bharm(?:ing)?\s+myself\b/i,
  /\bself[-\s]?harm\b/i,
  /\bcut(?:ting)?\s+myself\b/i,
  /\bdon'?t\s+want\s+to\s+(?:live|be\s+alive|be\s+here\s+anymore)\b/i,
  /\bno\s+reason\s+to\s+(?:live|go\s+on)\b/i,
  /\bend\s+it\s+all\b/i,
];

export function detectCrisis(text: string): boolean {
  return CRISIS_PATTERNS.some((re) => re.test(text));
}

export const CRISIS_RESPONSE = `I'm really glad you told me, and I'm sorry you're carrying this — it sounds heavy. I'm an AI coach and not equipped to give you the support you deserve right now, but please reach out to people who are:

- **Call or text 988** — the Suicide & Crisis Lifeline (US), free and available 24/7
- **Text HOME to 741741** — the Crisis Text Line
- Outside the US, [findahelpline.com](https://findahelpline.com) lists local hotlines

If you're in immediate danger, call 911. And if you can, tell someone close to you how you're feeling — a friend, family, or your coach at the gym. The mats will be there for you; right now the most important thing is you.`;
