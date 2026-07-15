"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createApiKey, revokeApiKey } from "./api-key-actions";

type KeyRow = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
};

// Developer card: create / list / revoke API keys for the public REST API.
// The raw key is shown exactly once after creation, with a copy button.
export function ApiKeysCard({ keys }: { keys: KeyRow[] }) {
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createApiKey(formData);
      if (res.error) setError(res.error);
      else if (res.key) {
        setNewKey(res.key);
        setCopied(false);
      }
    });
  }

  function onRevoke(id: string) {
    // Inline two-step confirm (native dialogs wedge browser tooling).
    if (confirmRevoke !== id) {
      setConfirmRevoke(id);
      return;
    }
    setConfirmRevoke(null);
    startTransition(async () => {
      const res = await revokeApiKey(id);
      if (res.error) setError(res.error);
    });
  }

  return (
    <section className="mt-12 max-w-2xl">
      <p className="font-mono text-[10px] uppercase tracking-dojo text-accent">
        Developer
      </p>
      <p className="mt-1 text-sm text-ink-mute">
        API keys for the FlowRoll REST API — read (and optionally write) your
        own training data from scripts and integrations.{" "}
        <Link href="/developers" className="text-accent hover:underline">
          API docs →
        </Link>
      </p>

      {error && (
        <p className="mt-3 font-mono text-[11px] text-accent">{error}</p>
      )}

      {newKey && (
        <div className="mt-4 rounded-sm border border-accent/40 bg-paper-raised p-4">
          <p className="text-sm text-ink">
            Your new key — copy it now, it won&apos;t be shown again:
          </p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <code className="font-mono text-[12px] bg-paper px-2 py-1.5 rounded-sm border border-paper-line break-all">
              {newKey}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(newKey);
                setCopied(true);
              }}
              className="text-xs font-medium text-accent hover:text-accent-deep transition"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
            <button
              type="button"
              onClick={() => setNewKey(null)}
              className="text-xs text-ink-mute hover:text-ink transition"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 rounded-sm bg-paper-raised border border-paper-line p-4">
        {keys.length === 0 ? (
          <p className="text-sm text-ink-mute">No API keys yet.</p>
        ) : (
          <ul className="space-y-3">
            {keys.map((k) => (
              <li
                key={k.id}
                className="flex items-center justify-between gap-3 flex-wrap"
              >
                <div>
                  <p className="text-sm text-ink">
                    {k.name}{" "}
                    <span className="font-mono text-[11px] text-ink-mute">
                      {k.prefix}…
                    </span>
                    {k.scopes.includes("write") && (
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-dojo text-accent">
                        write
                      </span>
                    )}
                  </p>
                  <p className="font-mono text-[10px] text-ink-mute">
                    created {new Date(k.created_at).toLocaleDateString()}
                    {k.last_used_at
                      ? ` · last used ${new Date(k.last_used_at).toLocaleDateString()}`
                      : " · never used"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onRevoke(k.id)}
                  className={`text-xs font-medium transition ${
                    confirmRevoke === k.id
                      ? "text-accent"
                      : "text-ink-mute hover:text-accent"
                  }`}
                >
                  {confirmRevoke === k.id ? "Really revoke?" : "Revoke"}
                </button>
              </li>
            ))}
          </ul>
        )}

        <form action={onCreate} className="mt-4 flex items-center gap-2 flex-wrap border-t border-paper-line pt-4">
          <input
            name="name"
            placeholder="Key name (e.g. my-script)"
            maxLength={60}
            required
            className="flex-1 min-w-[180px] bg-paper border border-paper-line rounded-sm px-3 py-2 text-sm text-ink placeholder:text-ink-mute focus:outline-none focus:border-accent transition"
          />
          <label className="flex items-center gap-1.5 text-xs text-ink-dim">
            <input type="checkbox" name="write" className="accent-accent" />
            allow writes
          </label>
          <button
            type="submit"
            disabled={pending}
            className="bg-accent text-paper px-4 py-2 rounded-sm text-sm font-medium hover:bg-accent-deep transition disabled:opacity-50"
          >
            {pending ? "…" : "Create key"}
          </button>
        </form>
      </div>
    </section>
  );
}
