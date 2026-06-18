// The fixed reaction palette for sessions. Small and mat-flavoured: fire,
// fist-bump/respect, strong, gi. Shared by the UI and the server action so the
// allowed set is defined once.
export const REACTIONS = ["🔥", "👊", "💪", "🥋"] as const;
export type Reaction = (typeof REACTIONS)[number];

export function isReaction(x: string): x is Reaction {
  return (REACTIONS as readonly string[]).includes(x);
}
