// Shared header + container for signed-in routes ("The Quarterly" chrome):
// 1px black bottom rule, wordmark with a red period, quiet 13px nav,
// name · belt on the right with the belt name in its belt color.
import Link from "next/link";
import { displayName } from "@/lib/profile";

type Belt = "white" | "blue" | "purple" | "brown" | "black";

type Profile = {
  id?: string;
  display_name: string;
  first_name?: string | null;
  last_name?: string | null;
  belt: Belt;
  stripes: number;
  avatar_url?: string | null;
};

const BELT_TEXT: Record<Belt, string> = {
  white: "text-ink-dim", // white-on-white is unreadable; use dim ink
  blue: "text-belt-blue",
  purple: "text-belt-purple",
  brown: "text-belt-brown",
  black: "text-belt-black",
};

const ROMAN = ["", "I", "II", "III", "IV"];

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
    <div className="min-h-screen flex flex-col bg-paper">
      <header className="border-b border-ink">
        <div className="mx-auto max-w-5xl px-5 sm:px-10 py-5 flex items-center justify-between gap-3 sm:gap-6">
          <Link
            href="/dashboard"
            className="text-[15px] font-semibold tracking-tightish"
          >
            flowroll<span className="text-accent">.</span>
          </Link>

          <nav className="flex items-center gap-4 sm:gap-6 text-[13px]">
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

          <div className="flex items-center gap-4">
            {profile &&
              (profile.id ? (
                <Link
                  href={`/u/${profile.id}`}
                  className="hidden sm:inline text-[13px] text-ink-dim hover:text-ink transition-colors"
                  title="Your profile"
                >
                  {displayName(profile)}
                  <span className="text-ink-mute"> · </span>
                  <span className={BELT_TEXT[profile.belt]}>
                    {profile.belt}
                    {profile.stripes > 0 ? ` ${ROMAN[profile.stripes]}` : ""}
                  </span>
                </Link>
              ) : (
                <span className="hidden sm:inline text-[13px] text-ink-dim">
                  {displayName(profile)}
                  <span className="text-ink-mute"> · </span>
                  <span className={BELT_TEXT[profile.belt]}>
                    {profile.belt}
                    {profile.stripes > 0 ? ` ${ROMAN[profile.stripes]}` : ""}
                  </span>
                </span>
              ))}
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="text-[11px] uppercase tracking-dojo text-ink-mute hover:text-ink transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-5 sm:px-10 py-9 sm:py-11">
          {children}
        </div>
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
          ? "text-ink font-semibold"
          : "text-ink-mute hover:text-ink transition-colors"
      }
    >
      {children}
    </Link>
  );
}
