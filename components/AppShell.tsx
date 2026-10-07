// Shared header + container for signed-in routes ("The Quarterly" chrome):
// 1px black bottom rule, wordmark with a red period, quiet 13px nav,
// name · belt on the right with the belt name in its belt color.
import Link from "next/link";
import { displayName } from "@/lib/profile";
import { SiteFooter } from "@/components/SiteFooter";
import { NotificationBell } from "@/components/NotificationBell";
import { createClient } from "@/lib/supabase/server";
import type { NotificationRow } from "@/lib/notifications";

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

export async function AppShell({
  children,
  profile,
  active,
  demo = false,
}: {
  children: React.ReactNode;
  profile: Profile | null;
  active: "dashboard" | "log" | "feed" | "chat" | "profile" | null;
  // Read-only sample athlete (/demo): nav points at demo routes, no bell,
  // "Sign in" in place of sign-out, banner on top.
  demo?: boolean;
}) {
  const nav = demo
    ? [
        ["/demo", "Dashboard", "dashboard"],
        ["/demo/log", "Log", "log"],
        ["/demo/feed", "Feed", "feed"],
        ["/demo/coach", "Coach", "chat"],
      ]
    : [
        ["/dashboard", "Dashboard", "dashboard"],
        ["/log", "Log", "log"],
        ["/feed", "Feed", "feed"],
        ["/chat", "Coach", "chat"],
      ];
  // Recent notifications for the bell — one small query per page.
  let items: NotificationRow[] = [];
  let unread = 0;
  if (profile?.id && !demo) {
    const supabase = createClient();
    const [{ data }, { count }] = await Promise.all([
      supabase
        .from("notifications")
        .select("id, type, actor_id, session_id, data, read_at, created_at")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .is("read_at", null),
    ]);
    items = (data ?? []) as NotificationRow[];
    unread = count ?? 0;
  }

  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {demo && (
        <div className="bg-ink text-paper">
          <p className="mx-auto max-w-5xl px-5 sm:px-10 py-2 text-[12px] flex items-center justify-between gap-4">
            <span>
              <span className="uppercase tracking-dojo text-[10px] text-paper/70 mr-3">Demo</span>
              A read-only look at FlowRoll with a sample athlete&apos;s log.
            </span>
            <Link href="/login" className="shrink-0 underline underline-offset-2 hover:text-accent transition-colors">
              Start your own →
            </Link>
          </p>
        </div>
      )}
      <header className="border-b border-ink">
        <div className="mx-auto max-w-5xl px-5 sm:px-10 py-5 flex items-center justify-between gap-3 sm:gap-6">
          <Link
            href={demo ? "/demo" : "/dashboard"}
            className="text-[15px] font-semibold tracking-tightish"
          >
            flowroll<span className="logo-dot text-accent">.</span>
          </Link>

          <nav className="flex items-center gap-4 sm:gap-6 text-[13px]">
            {nav.map(([href, label, key]) => (
              <NavLink key={href} href={href} active={active === key}>
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            {profile?.id && !demo && (
              <NotificationBell items={items} unread={unread} meId={profile.id} />
            )}
            {profile &&
              (profile.id || demo ? (
                <Link
                  href={demo ? "/demo/profile" : `/u/${profile.id}`}
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
            {demo ? (
              <Link
                href="/login"
                className="text-[11px] uppercase tracking-dojo text-ink-mute hover:text-ink transition-colors"
              >
                Sign in
              </Link>
            ) : (
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="text-[11px] uppercase tracking-dojo text-ink-mute hover:text-ink transition-colors"
                >
                  Sign out
                </button>
              </form>
            )}
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        <div className="mx-auto max-w-5xl px-5 sm:px-10 py-9 sm:py-11">
          {children}
        </div>
      </main>

      <SiteFooter />
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
      data-active={active}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "link-grow text-ink font-semibold"
          : "link-grow text-ink-mute hover:text-ink transition-colors"
      }
    >
      {children}
    </Link>
  );
}
