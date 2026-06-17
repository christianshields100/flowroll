// Shared header + container for signed-in routes (/dashboard, /log, /feed).
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { displayName } from "@/lib/profile";

type Profile = {
  id?: string;
  display_name: string;
  first_name?: string | null;
  last_name?: string | null;
  belt: "white" | "blue" | "purple" | "brown" | "black";
  stripes: number;
  avatar_url?: string | null;
};

export function AppShell({
  children,
  profile,
  active,
}: {
  children: React.ReactNode;
  profile: Profile | null;
  active: "dashboard" | "log" | "feed" | "chat" | null;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-paper-line bg-paper">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-4 flex items-center justify-between gap-3 sm:gap-6">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <span aria-hidden className="block h-5 w-9 bg-accent rounded-[1px] relative overflow-hidden">
              <span className="absolute right-1.5 top-0 bottom-0 w-1 bg-belt-black" />
              <span className="absolute right-2.5 top-0 bottom-0 w-px bg-paper/70" />
            </span>
            <span className="hidden sm:inline font-display text-lg tracking-tightish group-hover:text-accent transition">
              flowroll
            </span>
          </Link>

          <nav className="flex items-center gap-4 sm:gap-6 text-sm">
            <NavLink href="/dashboard" active={active === "dashboard"}>
              Dashboard
            </NavLink>
            <NavLink href="/log" active={active === "log"}>
              Log
            </NavLink>
            <NavLink href="/feed" active={active === "feed"}>
              Feed
            </NavLink>
            <NavLink href="/chat" active={active === "chat"}>
              Coach
            </NavLink>
          </nav>

          <div className="flex items-center gap-3">
            {profile &&
              (profile.id ? (
                <Link
                  href={`/u/${profile.id}`}
                  className="flex items-center gap-2 group"
                  title="Your profile"
                >
                  <Avatar
                    url={profile.avatar_url}
                    name={displayName(profile)}
                    belt={profile.belt}
                    size="sm"
                  />
                  <span className="hidden sm:inline font-mono text-xs text-ink-dim group-hover:text-accent transition">
                    {displayName(profile)}
                  </span>
                </Link>
              ) : (
                <span className="flex items-center gap-2">
                  <Avatar
                    url={profile.avatar_url}
                    name={displayName(profile)}
                    belt={profile.belt}
                    size="sm"
                  />
                  <span className="hidden sm:inline font-mono text-xs text-ink-dim">
                    {displayName(profile)}
                  </span>
                </span>
              ))}
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
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-10">{children}</div>
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
