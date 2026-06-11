// Canonical submission names. Seeds the log-form autocomplete so tallies
// don't fragment across spellings ("RNC" vs "rear naked choke" vs "man bar").
// The user's own past entries are merged in at the call site.
export const CANONICAL_SUBMISSIONS = [
  // Chokes
  "rear naked choke",
  "guillotine",
  "triangle",
  "arm triangle",
  "d'arce",
  "anaconda",
  "cross collar choke",
  "bow and arrow",
  "loop choke",
  "ezekiel",
  "baseball bat choke",
  "north-south choke",
  "clock choke",
  "paper cutter",
  "von flue",
  // Arm attacks
  "armbar",
  "kimura",
  "americana",
  "omoplata",
  "wrist lock",
  "bicep slicer",
  // Leg attacks
  "heel hook",
  "kneebar",
  "straight ankle lock",
  "toe hold",
  "calf slicer",
  // Other
  "twister",
] as const;

// Merge canonical + previously-used names into one deduped suggestion list.
// Case-insensitive dedupe that prefers the spelling the user actually used.
export function submissionSuggestions(past: string[]): string[] {
  const seen = new Map<string, string>();
  for (const name of [...past, ...CANONICAL_SUBMISSIONS]) {
    const key = name.trim().toLowerCase();
    if (key && !seen.has(key)) seen.set(key, name.trim());
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
}
