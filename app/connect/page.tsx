import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { SiteFooter } from "@/components/SiteFooter";
import { CopyField } from "@/components/CopyField";

export const metadata: Metadata = {
  title: "Connect FlowRoll to your AI tool — FlowRoll",
  description:
    "Add FlowRoll to Claude, ChatGPT, Cursor, and other AI tools so they can read your log, pull your stats, and log sessions for you.",
};

export const dynamic = "force-dynamic";

const MCP_URL = "https://www.flowroll.xyz/api/mcp";

// One page, every major AI tool: how to connect FlowRoll (OAuth, no keys).
// Shown inside the app for signed-in athletes and as a public page otherwise.
export default async function ConnectPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("id, display_name, first_name, last_name, belt, stripes, avatar_url")
        .eq("id", user.id)
        .single()
    : { data: null };

  const body = (
    <article className="max-w-[720px]">
      <div className="rise border-b border-ink pb-6">
        <p className="text-[11px] uppercase tracking-dojo text-ink-mute">Connect to AI tools</p>
        <h1 className="mt-2 text-[30px] sm:text-[34px] leading-[1.1] font-medium tracking-tightish">
          FlowRoll, inside your AI tool.
        </h1>
        <p className="mt-4 text-ink-dim leading-relaxed">
          Connect once and Claude, ChatGPT, Cursor, or any other MCP-compatible assistant can
          read your log, pull your stats, log sessions from a sentence, fix an entry, or update
          your belt. You sign in with your FlowRoll account and click <b className="text-ink">Allow</b>. No
          keys, nothing to copy except the address below.
        </p>
        <CopyField value={MCP_URL} label="Copy URL" />
      </div>

      <div className="rise rise-1 mt-10 space-y-10">
        <Tool name="Claude" sub="claude.ai and the Claude desktop app">
          <Steps
            items={[
              <>Open <b>Settings → Connectors</b> (in the desktop app: Settings → Connectors as well).</>,
              <>Click <b>Add custom connector</b>, name it <b>FlowRoll</b>, paste the URL above, and click Add.</>,
              <>Click <b>Connect</b>. A FlowRoll page opens — sign in if you aren&apos;t already, then click <b>Allow</b>.</>,
              <>In any chat, make sure FlowRoll is enabled under the tools menu (the + or sliders icon), then ask away.</>,
            ]}
          />
          <Note>Custom connectors are available on Claude&apos;s paid plans. On the free plan, use Claude Code below.</Note>
        </Tool>

        <Tool name="Claude Code" sub="in the terminal">
          <Steps
            items={[
              <>Run the command below once.</>,
              <>Type <Mono>/mcp</Mono>, pick <b>flowroll</b>, and choose Authenticate. Your browser opens the FlowRoll sign-in; click <b>Allow</b>.</>,
            ]}
          />
          <CopyField value={`claude mcp add --transport http flowroll ${MCP_URL}`} label="Copy" />
        </Tool>

        <Tool name="ChatGPT" sub="chatgpt.com and the desktop apps">
          <Steps
            items={[
              <>Open <b>Settings → Connectors</b>, then <b>Advanced settings</b> and turn on <b>Developer mode</b>.</>,
              <>Back in Connectors, click <b>Create</b>. Name it <b>FlowRoll</b>, paste the URL, set authentication to <b>OAuth</b>, and save.</>,
              <>Click <b>Connect</b> and sign in to FlowRoll when the page opens, then <b>Allow</b>.</>,
              <>In a chat, open the <b>+</b> menu → <b>More</b> and switch on FlowRoll.</>,
            ]}
          />
          <Note>Custom connectors require a paid ChatGPT plan. Menu names move around; look for &quot;Connectors&quot; or &quot;Apps&quot; in Settings.</Note>
        </Tool>

        <Tool name="Cursor" sub="the AI code editor">
          <Steps
            items={[
              <>Open <b>Cursor Settings → MCP</b> and click <b>Add new MCP server</b>, or add the snippet below to <Mono>~/.cursor/mcp.json</Mono>.</>,
              <>Click <b>Login</b> / <b>Authenticate</b> next to flowroll when it appears. Sign in to FlowRoll and click <b>Allow</b>.</>,
            ]}
          />
          <Code>{`{
  "mcpServers": {
    "flowroll": { "url": "${MCP_URL}" }
  }
}`}</Code>
        </Tool>

        <Tool name="VS Code" sub="with GitHub Copilot">
          <Steps
            items={[
              <>Open the Command Palette and run <b>MCP: Add Server</b>.</>,
              <>Choose <b>HTTP</b>, paste the URL, name it <b>flowroll</b>, and save to your user settings.</>,
              <>When VS Code asks to authenticate, allow it; sign in to FlowRoll and click <b>Allow</b>.</>,
            ]}
          />
        </Tool>

        <Tool name="Gemini CLI" sub="Google's terminal agent">
          <Steps
            items={[
              <>Add FlowRoll to <Mono>~/.gemini/settings.json</Mono> with the snippet below, or run the command.</>,
              <>Type <Mono>/mcp auth flowroll</Mono>. Sign in to FlowRoll and click <b>Allow</b>.</>,
            ]}
          />
          <CopyField value={`gemini mcp add --transport http flowroll ${MCP_URL}`} label="Copy" />
        </Tool>

        <Tool name="Windsurf" sub="and other MCP-compatible tools">
          <p className="text-sm text-ink-dim leading-relaxed">
            Any tool that supports remote MCP servers works the same way: add a server with the
            URL above (Windsurf calls the field <Mono>serverUrl</Mono> in{" "}
            <Mono>~/.codeium/windsurf/mcp_config.json</Mono>), then approve the sign-in window
            that opens on first use.
          </p>
        </Tool>
      </div>

      <div className="rise rise-2 mt-14 border-t border-ink pt-8">
        <p className="text-[11px] uppercase tracking-dojo text-ink-mute">Once it&apos;s connected</p>
        <h2 className="mt-2 text-2xl font-medium tracking-tightish">Things to try</h2>
        <ul className="mt-4 space-y-2 text-sm text-ink">
          {[
            "Log today: 75 minutes at Clockwork, 6 rounds, hit two triangles, got caught in a heel hook, felt like a 4.",
            "What keeps catching me?",
            "How many hours have I trained since my promotion?",
            "Fix yesterday's session — it was an open mat, 5 rounds, with Dani and Marcus.",
            "I got my second stripe today. Update my profile.",
            "Compare this month to last month.",
          ].map((q) => (
            <li key={q} className="border-l-2 border-accent pl-3 italic text-ink-dim">
              &ldquo;{q}&rdquo;
            </li>
          ))}
        </ul>
      </div>

      <div className="rise rise-3 mt-14 border-t border-ink pt-8 grid sm:grid-cols-2 gap-8">
        <div>
          <p className="text-[11px] uppercase tracking-dojo text-ink-mute">What it can do</p>
          <ul className="mt-3 space-y-1.5 text-sm text-ink-dim">
            <li>Read your sessions, stats, belt, and home gym</li>
            <li>Log, edit, and delete sessions</li>
            <li>Update your name, belt, stripes, home gym, and privacy</li>
          </ul>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-dojo text-ink-mute">What it can&apos;t</p>
          <ul className="mt-3 space-y-1.5 text-sm text-ink-dim">
            <li>See other athletes&apos; data, your email, or your date of birth</li>
            <li>Delete your account</li>
            <li>Keep access after you disconnect it</li>
          </ul>
          <p className="mt-3 text-[12px] text-ink-mute">
            Disconnect any tool in{" "}
            <Link href="/settings#connected-apps" className="underline hover:text-ink">
              Settings → Connected apps
            </Link>
            . Building your own? See the{" "}
            <Link href="/developers" className="underline hover:text-ink">
              API docs
            </Link>
            .
          </p>
        </div>
      </div>
    </article>
  );

  if (profile) {
    return (
      <AppShell profile={profile} active="connect">
        {body}
      </AppShell>
    );
  }
  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <header className="border-b border-ink">
        <div className="mx-auto max-w-5xl px-5 sm:px-10 py-5 flex items-center justify-between">
          <Link href="/" className="text-[15px] font-semibold tracking-tightish">
            flowroll<span className="text-accent">.</span>
          </Link>
          <Link href="/login" className="text-[13px] text-ink-dim hover:text-ink transition-colors">
            Sign in
          </Link>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-5 sm:px-10 py-9 sm:py-11">{body}</div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Tool({ name, sub, children }: { name: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-paper-line pt-6">
      <h2 className="text-xl font-medium tracking-tightish">
        {name} <span className="text-ink-mute font-normal text-base">— {sub}</span>
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-2 text-sm text-ink-dim leading-relaxed">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3">
          <span className="num text-accent shrink-0 w-4">{i + 1}.</span>
          <span>{it}</span>
        </li>
      ))}
    </ol>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[12px] italic text-ink-mute leading-relaxed">{children}</p>;
}

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-3 border border-ink px-3 py-2.5 font-mono text-[13px] text-ink overflow-x-auto whitespace-pre">
      {children}
    </pre>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[12.5px] bg-paper-sunken px-1 py-0.5">{children}</code>;
}
