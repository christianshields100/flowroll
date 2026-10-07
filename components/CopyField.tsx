"use client";

import { useState } from "react";

// A read-only value with a one-click copy, for URLs and commands.
export function CopyField({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the text is still selectable */
    }
  }
  return (
    <div className="mt-3 flex items-stretch border border-ink">
      <code className="flex-1 min-w-0 px-3 py-2.5 font-mono text-[13px] text-ink overflow-x-auto whitespace-nowrap">
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        className="pressable shrink-0 px-4 text-[11px] uppercase tracking-dojo bg-ink text-paper hover:opacity-80"
      >
        {copied ? "Copied" : label}
      </button>
    </div>
  );
}
