"use client";

import { useState, useTransition } from "react";
import { deleteMyAccount } from "./delete-account-actions";

// Account deletion with a typed confirmation — deliberately harder than a
// two-click confirm because this one is irreversible.
export function DangerZone() {
  const [armed, setArmed] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deleteMyAccount();
      // On success the action redirects; reaching here means it failed.
      if (res?.error) setError(res.error);
    });
  }

  return (
    <section className="mt-12 max-w-2xl">
      <p className="text-[11px] uppercase tracking-dojo text-accent">
        Danger zone
      </p>
      <p className="mt-1 text-sm text-ink-mute">
        Deleting your account permanently removes everything — your profile,
        sessions, photos and videos, Coach conversations,
        followers, and API keys. Effective immediately; there is no undo.
      </p>

      <div className="mt-4 border border-accent/40 p-4">
        {!armed ? (
          <button
            type="button"
            onClick={() => setArmed(true)}
            className="text-[13px] text-accent hover:text-accent-deep transition-colors"
          >
            Delete my account…
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink">
              Type <span className="font-semibold">delete</span> to confirm.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="delete"
                className="bg-transparent border-b border-ink px-0 py-1.5 text-[15px] text-ink placeholder:italic placeholder:text-ink-mute focus:outline-none focus:border-b-accent transition-colors"
              />
              <button
                type="button"
                disabled={pending || confirmText.trim().toLowerCase() !== "delete"}
                onClick={onDelete}
                className="pressable bg-accent text-paper px-5 py-2 text-[13px] font-semibold hover:bg-accent-deep disabled:opacity-40"
              >
                {pending ? "Deleting…" : "Permanently delete"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setArmed(false);
                  setConfirmText("");
                }}
                className="text-[13px] text-ink-mute hover:text-ink transition-colors"
              >
                Cancel
              </button>
            </div>
            {error && (
              <p className="text-[13px] text-accent">{error}</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
