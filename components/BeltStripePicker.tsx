"use client";

// Belt + stripe selector. Writes `belt` and `stripes` hidden inputs for the
// surrounding form. Used in Edit Profile and onboarding. With `askIntent`,
// a change away from the saved rank also asks whether it's a promotion
// (goes on the journey, with a date) or a correction (just fixes the belt).
import { useState } from "react";

const BELTS = ["white", "blue", "purple", "brown", "black"] as const;
const BELT_BG: Record<(typeof BELTS)[number], string> = {
  white: "bg-belt-white",
  blue: "bg-belt-blue",
  purple: "bg-belt-purple",
  brown: "bg-belt-brown",
  black: "bg-belt-black",
};

function rank(belt: string, stripes: number) {
  return Math.max(0, BELTS.indexOf(belt as (typeof BELTS)[number])) * 5 + stripes;
}

export function BeltStripePicker({
  initialBelt = "white",
  initialStripes = 0,
  askIntent = false,
}: {
  initialBelt?: string;
  initialStripes?: number;
  askIntent?: boolean;
}) {
  const [belt, setBelt] = useState<string>(initialBelt);
  const [stripes, setStripes] = useState<number>(initialStripes);
  const [kind, setKind] = useState<"promotion" | "correction" | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [promotedOn, setPromotedOn] = useState(today);

  const changed = belt !== initialBelt || stripes !== initialStripes;
  const up = rank(belt, stripes) > rank(initialBelt, initialStripes);
  // Default to the likely intent; the athlete can flip it.
  const effectiveKind = kind ?? (up ? "promotion" : "correction");

  return (
    <div>
      <input type="hidden" name="belt" value={belt} />
      <input type="hidden" name="stripes" value={stripes} />

      <div className="flex flex-wrap gap-2">
        {BELTS.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setBelt(b)}
            className={`flex items-center gap-2 px-3 py-2 rounded-sm border text-sm capitalize transition ${
              belt === b
                ? "border-accent text-ink"
                : "border-paper-line text-ink-dim hover:text-ink"
            }`}
          >
            <span
              className={`block h-3 w-6 ${BELT_BG[b]} rounded-[1px] border border-black/10`}
            />
            {b}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute mr-1">
          Stripes
        </span>
        {[0, 1, 2, 3, 4].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setStripes(n)}
            className={`h-8 w-8 rounded-sm border font-mono text-sm transition ${
              stripes === n
                ? "bg-accent text-paper border-accent"
                : "border-paper-line text-ink-dim hover:text-ink"
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      {askIntent && changed && (
        <div className="mt-4 border-l-2 border-accent pl-4 space-y-2" data-belt-intent>
          <input type="hidden" name="belt_change_kind" value={effectiveKind} />
          <p className="text-[11px] uppercase tracking-dojo text-ink-mute">What is this change?</p>
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="belt_change_kind_choice"
              checked={effectiveKind === "promotion"}
              onChange={() => setKind("promotion")}
              disabled={!up}
              className="mt-1 accent-accent"
            />
            <span className={up ? "" : "text-ink-mute"}>
              <span className="block text-ink">A promotion</span>
              <span className="block text-[12px] text-ink-mute">
                {up ? "Goes on your journey timeline, with a date." : "Only available when the new rank is higher."}
              </span>
            </span>
          </label>
          {effectiveKind === "promotion" && (
            <div className="ml-6 flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-dojo text-ink-mute">Promoted on</span>
              <input
                type="date"
                name="promoted_on"
                value={promotedOn}
                max={today}
                onChange={(e) => setPromotedOn(e.target.value)}
                className="bg-transparent border-b border-ink px-0 py-1 text-sm text-ink focus:outline-none focus:border-accent"
              />
            </div>
          )}
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="belt_change_kind_choice"
              checked={effectiveKind === "correction"}
              onChange={() => setKind("correction")}
              className="mt-1 accent-accent"
            />
            <span>
              <span className="block text-ink">A correction</span>
              <span className="block text-[12px] text-ink-mute">
                The saved rank was wrong. Fixes it without adding to your timeline.
              </span>
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
