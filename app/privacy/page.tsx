import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — FlowRoll",
  description: "How FlowRoll handles your data.",
};

// Plain, honest privacy policy. Also the URL WHOOP shows in its OAuth consent
// screen. Not legal advice — review before relying on it commercially.
export default function PrivacyPage() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-paper-line">
        <div className="mx-auto max-w-3xl px-6 py-5 flex items-center justify-between">
          <Link
            href="/"
            className="font-display text-lg tracking-tightish hover:text-accent transition"
          >
            flowroll
          </Link>
          <Link
            href="/login"
            className="text-sm text-ink-dim hover:text-accent transition"
          >
            Sign in
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-16 prose-flowroll">
        <p className="font-mono text-xs uppercase tracking-dojo text-ink-mute">
          Privacy Policy
        </p>
        <h1 className="mt-2 font-display text-4xl tracking-tightish">
          What we do with your data
        </h1>
        <p className="mt-2 font-mono text-[11px] text-ink-mute">
          Last updated: July 2026
        </p>
        <div className="belt-rule mt-6 max-w-sm" />

        <div className="mt-8 space-y-8 text-ink-dim leading-relaxed">
          <Section title="Who this is for">
            FlowRoll is a training log for Brazilian Jiu-Jitsu. This policy
            covers the FlowRoll web app at flowroll.xyz.
          </Section>

          <Section title="What we collect">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <b>Account</b> — your email address (for sign-in), and the name,
                belt, date of birth, and optional home gym you provide during
                setup.
              </li>
              <li>
                <b>Training data</b> — the sessions you log: dates, duration,
                rounds, submissions, training partners, notes, and any photos or
                videos you attach.
              </li>
              <li>
                <b>Coach conversations</b> — messages you send to the in-app AI
                Coach, kept so your conversation persists.
              </li>
              <li>
                <b>WHOOP data (only if you connect it)</b> — recovery, strain,
                heart rate, sleep, and workout data pulled from your WHOOP
                account to enrich your own sessions and stats.
              </li>
            </ul>
          </Section>

          <Section title="How we use it">
            To run the app: show your logbook and stats, power the AI Coach,
            let you share sessions with training partners you choose, and — if
            connected — correlate your WHOOP metrics with your training. We do
            not sell your data or use it for advertising.
          </Section>

          <Section title="What others can see">
            You control your visibility. A public account&apos;s sessions are
            visible to signed-in users; a private account&apos;s sessions are
            visible only to followers you approve. Your{" "}
            <b>date of birth is never shown</b>, and your{" "}
            <b>WHOOP / health data is never shared</b> with anyone — it is
            visible only to you.
          </Section>

          <Section title="Third parties">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <b>Supabase</b> — hosts the database, authentication, and file
                storage.
              </li>
              <li>
                <b>Anthropic</b> — processes Coach messages (with your training
                context) to generate responses. Not used to train their models
                under their commercial terms.
              </li>
              <li>
                <b>WHOOP</b> — source of your health data, only if you connect
                it; you can disconnect at any time in Settings.
              </li>
              <li>
                <b>Vercel</b> — hosts and serves the application.
              </li>
            </ul>
          </Section>

          <Section title="Your choices">
            You can edit your profile and disconnect WHOOP anytime in Settings.
            To delete your account and associated data, email{" "}
            <a
              href="mailto:christianshields100@gmail.com"
              className="text-accent hover:underline"
            >
              christianshields100@gmail.com
            </a>{" "}
            and we&apos;ll remove it.
          </Section>

          <Section title="Contact">
            Questions about privacy? Email{" "}
            <a
              href="mailto:christianshields100@gmail.com"
              className="text-accent hover:underline"
            >
              christianshields100@gmail.com
            </a>
            .
          </Section>
        </div>

        <div className="mt-12">
          <Link
            href="/"
            className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute hover:text-accent transition"
          >
            ← Back to FlowRoll
          </Link>
        </div>
      </article>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-xl tracking-tightish text-ink">
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
