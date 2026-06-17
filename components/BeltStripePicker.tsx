"use client";

// Belt + stripe selector. Writes `belt` and `stripes` hidden inputs for the
// surrounding form. Used in Edit Profile and onboarding.
import { useState } from "react";

const BELTS = ["white", "blue", "purple", "brown", "black"] as const;
const BELT_BG: Record<(typeof BELTS)[number], string> = {
  white: "bg-belt-white",
  blue: "bg-belt-blue",
  purple: "bg-belt-purple",
  brown: "bg-belt-brown",
  black: "bg-belt-black",
};

export function BeltStripePicker({
  initialBelt = "white",
  initialStripes = 0,
}: {
  initialBelt?: string;
  initialStripes?: number;
}) {
  const [belt, setBelt] = useState<string>(initialBelt);
  const [stripes, setStripes] = useState<number>(initialStripes);

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
    </div>
  );
}
