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

// Injury/medical detection (owner's liability directive): Coach must not
// answer health or injury questions at all. Same pattern as the crisis
// gate — clear medical phrasing gets a deterministic redirect before the
// model runs. Ordinary gym talk ("sore from yesterday", "that choke hurt")
// must NOT trigger, so patterns target explicit injury/medical language.
const INJURY_PATTERNS: RegExp[] = [
  /\binjur(?:y|ies|ed)\b/i,
  /\bsprain(?:ed)?\b/i,
  /\b(?:torn|tore|tear(?:ing)?)\s+(?:my\s+)?(?:acl|mcl|lcl|meniscus|rotator|labrum|ligament|muscle|tendon)\b/i,
  /\b(?:acl|mcl|meniscus|rotator\s+cuff|labrum)\b/i,
  /\bdislocat(?:ed|ion)\b/i,
  /\b(?:broke|broken|fractur(?:e|ed))\s+(?:my\s+)?(?:\w+\s+)?(?:bone|finger|toe|rib|nose|hand|foot|arm|wrist|ankle)\b/i,
  /\bconcuss(?:ion|ed)\b/i,
  /\bhit\s+my\s+head\b/i,
  /\b(?:numb(?:ness)?|tingling)\b/i,
  /\bheard\s+a\s+pop\b/i,
  /\bswollen|swelling\b/i,
  /\bcan'?t\s+(?:move|bend|straighten|put\s+weight)\b/i,
  /\bshould\s+i\s+see\s+a\s+doctor\b/i,
  /\b(?:diagnos|prescri|medication|painkiller)/i,
  /\btrain(?:ing)?\s+(?:through|with|on)\s+(?:the\s+|an?\s+)?(?:pain|injury)\b/i,
  /\bsharp\s+pain\b/i,
  /\bpain\s+(?:in|when|that|won'?t)\b/i,
];

export function detectInjury(text: string): boolean {
  return INJURY_PATTERNS.some((re) => re.test(text));
}

export const INJURY_RESPONSE = `I can't help with injuries or anything medical — I'm an AI coach, not a doctor, and getting this wrong could genuinely hurt you.

Please have it looked at by a healthcare professional (a doctor or physical therapist familiar with grappling injuries is ideal), and hold off on training with it until you're cleared. BJJ is hard on the body — the athletes with the longest careers are the ones who take injuries seriously early.

I'm happy to talk technique, your training history, or anything else on the mat once you're back.`;
