import { syncWhoopNow, disconnectWhoop } from "./whoop-actions";

// Connection status card for the settings page. Server component: the connect
// flow is a plain link to the OAuth route; sync/disconnect are form actions.
export function WhoopCard({
  configured,
  connection,
  notice,
}: {
  configured: boolean;
  connection: { last_synced_at: string | null } | null;
  notice?: string;
}) {
  return (
    <section className="mt-12 max-w-2xl">
      <p className="font-mono text-[10px] uppercase tracking-dojo text-accent">
        WHOOP
      </p>
      <p className="mt-1 text-sm text-ink-mute">
        Pull strain, heart rate, and recovery onto your sessions. Your health
        data stays private — only you see it, never your followers.
      </p>

      {notice && (
        <p className="mt-3 font-mono text-[11px] text-ink-dim">
          {notice}
        </p>
      )}

      <div className="mt-4 rounded-sm bg-paper-raised border border-paper-line p-4">
        {!configured ? (
          <p className="text-sm text-ink-mute">
            WHOOP isn&apos;t set up on this deployment yet.
          </p>
        ) : connection ? (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm text-ink">
                <span className="inline-block h-2 w-2 rounded-full bg-accent mr-2 align-middle" />
                Connected
              </p>
              <p className="mt-1 font-mono text-[11px] text-ink-mute">
                {connection.last_synced_at
                  ? `Last synced ${new Date(connection.last_synced_at).toLocaleString()}`
                  : "Not synced yet"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <form action={syncWhoopNow}>
                <button
                  type="submit"
                  className="font-mono text-[10px] uppercase tracking-dojo px-3 py-1.5 rounded-sm bg-accent text-paper hover:bg-accent-deep transition"
                >
                  Sync now
                </button>
              </form>
              <form action={disconnectWhoop}>
                <button
                  type="submit"
                  className="font-mono text-[10px] uppercase tracking-dojo px-3 py-1.5 rounded-sm border border-paper-line text-ink-mute hover:border-accent hover:text-accent transition"
                >
                  Disconnect
                </button>
              </form>
            </div>
          </div>
        ) : (
          <a
            href="/api/whoop/connect"
            className="inline-block bg-accent text-paper px-5 py-2.5 rounded-sm font-medium hover:bg-accent-deep transition"
          >
            Connect WHOOP
          </a>
        )}
      </div>
    </section>
  );
}
