// Shared header + container for signed-in routes (/dashboard, /log, /feed).
import Link from "next/link";

type Profile = {
  display_name: string;
  belt: "white" | "blue" | "purple" | "brown" | "black";
  stripes: number;
};

const BELT_BG: Record<Profile["belt"], string> = {
  white: "bg-belt-white",
  blue: "bg-belt-blue",
  purple: "bg-belt-purple",
  brown: "bg-belt-brown",
  black: "bg-belt-black",
};

export function AppShell({
  children,
  profile,
  active,
}: {
  children: React.ReactNode;
  profile: Profile | null;
  active: "dashboard" | "log" | "feed";
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-paper-line bg-paper">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between gap-6">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <span aria-hidden className="block h-5 w-9 bg-accent rounded-[1px] relative overflow-hidden">
              <span className="absolute right-1.5 top-0 bottom-0 w-1 bg-belt-black" />
              <span className="absolute right-2.5 top-0 bottom-0 w-px bg-paper/70" />
            </span>
            <span className="font-display text-lg tracking-tightish group-hover:text-accent transition">
              flowroll
            </span>
          </Link>

          <nav className="flex items-center gap-6 text-sm">
            <NavLink href="/dashboard" active={active === "dashboard"}>
              Dashboard
            </NavLink>
            <NavLink href="/log" active={active === "log"}>
              Log
            </NavLink>
            <NavLink href="/feed" active={active === "feed"}>
              Feed
            </NavLink>
          </nav>

          <div className="flex items-center gap-3">
            {profile && (
              <span className="hidden sm:flex items-center gap-2">
                <span
                  aria-hidden
                  className={`block h-3 w-6 ${BELT_BG[profile.belt]} rounded-[1px] relative overflow-hidden`}
                >
                  {Array.from({ length: profile.stripes }).map((_, i) => (
                    <span
                      key={i}
                      className="absolute top-0 bottom-0 w-[3px] bg-belt-stripe/95"
                      style={{ right: `${4 + i * 5}px` }}
                    />
                  ))}
                </span>
                <span className="font-mono text-xs text-ink-dim">
                  {profile.display_name}
                </span>
              </span>
            )}
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute hover:text-accent transition"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-6 py-10">{children}</div>
      </main>
    </div>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "text-ink border-b-2 border-accent pb-1"
          : "text-ink-dim hover:text-ink transition pb-1 border-b-2 border-transparent"
      }
    >
      {children}
    </Link>
  );
}
