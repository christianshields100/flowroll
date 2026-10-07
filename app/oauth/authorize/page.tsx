import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/profile";
import { SiteFooter } from "@/components/SiteFooter";
import { decideAuthorization } from "./actions";

export const dynamic = "force-dynamic";

// OAuth consent screen. Middleware guarantees the athlete is signed in; here
// we validate the client + redirect and ask for one click.
export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, first_name, last_name, belt, stripes")
    .eq("id", user!.id)
    .single();

  const clientId = searchParams.client_id ?? "";
  const redirectUri = searchParams.redirect_uri ?? "";
  const state = searchParams.state ?? "";
  const challenge = searchParams.code_challenge ?? "";
  const method = searchParams.code_challenge_method ?? "";
  const responseType = searchParams.response_type ?? "code";
  const scope = (searchParams.scope ?? "read write").trim() || "read write";

  let problem: string | null = null;
  let clientName = "An AI assistant";
  if (searchParams.error) problem = "That request was malformed. Go back to the app and try connecting again.";
  else if (!/^[0-9a-f-]{36}$/i.test(clientId) || !redirectUri || !challenge) problem = "This connection request is missing details.";
  else if (responseType !== "code" || method !== "S256") problem = "This app is using an unsupported sign-in method.";
  else {
    const { data } = await supabase.rpc("oauth_client_info", { p_client_id: clientId });
    const c = (data as { client_name: string; redirect_uris: string[] }[] | null)?.[0];
    if (!c) problem = "This app isn't registered with FlowRoll.";
    else if (!c.redirect_uris.includes(redirectUri)) problem = "This app's return address doesn't match its registration.";
    else clientName = c.client_name;
  }

  const wantsWrite = /\bwrite\b/.test(scope);

  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <header className="border-b border-ink">
        <div className="mx-auto max-w-5xl px-5 sm:px-10 py-5">
          <span className="text-[15px] font-semibold tracking-tightish">
            flowroll<span className="text-accent">.</span>
          </span>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-md px-5 py-16">
          <p className="text-[11px] uppercase tracking-dojo text-ink-mute">Connect an app</p>
          <h1 className="mt-2 text-[30px] leading-[1.1] font-medium tracking-tightish">
            {clientName} wants access to your log.
          </h1>

          {problem ? (
            <p className="mt-6 text-sm text-accent-deep">{problem}</p>
          ) : (
            <>
              <p className="mt-4 text-sm text-ink-dim">
                Signed in as <b className="text-ink">{profile ? displayName(profile) : "you"}</b>.
              </p>
              <ul className="mt-6 border-t border-ink divide-y divide-paper-line text-sm">
                <li className="py-3 flex gap-3">
                  <span className="text-accent">✓</span>
                  <span>Read your sessions, stats, belt, and home gym</span>
                </li>
                {wantsWrite && (
                  <li className="py-3 flex gap-3">
                    <span className="text-accent">✓</span>
                    <span>Log new sessions on your behalf</span>
                  </li>
                )}
                <li className="py-3 flex gap-3 text-ink-mute">
                  <span>✕</span>
                  <span>Cannot see other athletes&apos; data, change your profile, or delete anything</span>
                </li>
              </ul>
              <form action={decideAuthorization} className="mt-8 flex items-center gap-3">
                <input type="hidden" name="client_id" value={clientId} />
                <input type="hidden" name="redirect_uri" value={redirectUri} />
                <input type="hidden" name="state" value={state} />
                <input type="hidden" name="code_challenge" value={challenge} />
                <input type="hidden" name="scope" value={scope} />
                <button
                  type="submit"
                  name="decision"
                  value="allow"
                  className="pressable bg-ink text-paper px-7 py-3 text-[13px] font-semibold hover:opacity-80"
                >
                  Allow
                </button>
                <button
                  type="submit"
                  name="decision"
                  value="deny"
                  className="text-[13px] px-5 py-3 text-ink-mute hover:text-ink transition-colors"
                >
                  Deny
                </button>
              </form>
              <p className="mt-6 text-[12px] text-ink-mute leading-relaxed">
                You can disconnect it any time in{" "}
                <Link href="/settings#connected-apps" className="underline hover:text-ink">
                  Settings → Connected apps
                </Link>
                . Access expires on its own after 90 days of disuse.
              </p>
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
