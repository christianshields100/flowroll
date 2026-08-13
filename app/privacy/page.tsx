import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — FlowRoll",
  description: "How FlowRoll handles your data.",
};

// Written from the app's actual data practices (see COMPLIANCE.md). Also the
// URL WHOOP shows in its OAuth consent screen. Not legal advice — have a
// lawyer review before relying on it commercially.
export default function PrivacyPage() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-ink">
        <div className="mx-auto max-w-3xl px-6 py-5 flex items-center justify-between">
          <Link
            href="/"
            className="text-[15px] font-semibold tracking-tightish"
          >
            flowroll<span className="text-accent">.</span>
          </Link>
          <Link
            href="/login"
            className="text-sm text-ink-dim hover:text-ink transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-[11px] uppercase tracking-dojo text-ink-mute">
          Privacy Policy
        </p>
        <h1 className="mt-2 text-[34px] leading-[1.1] font-medium tracking-tightish">
          What we do with your data
        </h1>
        <p className="mt-2 text-[11px] text-ink-mute">
          Effective date: August 13, 2026
        </p>
        <div className="belt-rule mt-6" />

        <div className="mt-8 space-y-8 text-ink-dim leading-relaxed">
          <Section title="Who this is for">
            FlowRoll is a training log and community for Brazilian Jiu-Jitsu
            athletes, operated as an independent product. This policy covers
            the FlowRoll web app at flowroll.xyz and its API.
          </Section>

          <Section title="What we collect">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <b>Account</b> — your email address (for sign-in), and the
                name, date of birth, belt rank, profile photo, and optional
                home gym you provide during setup.
              </li>
              <li>
                <b>Training data</b> — the sessions you log: dates, duration,
                rounds, submissions, training partners, notes, and any photos
                or videos you attach.
              </li>
              <li>
                <b>Social activity</b> — who you follow, and the reactions and
                comments you leave on sessions.
              </li>
              <li>
                <b>Coach conversations</b> — messages you exchange with the
                in-app AI Coach, kept so your conversation persists (you can
                clear it anytime from the chat page).
              </li>
              <li>
                <b>WHOOP data (only if you connect it)</b> — recovery, strain,
                heart rate, sleep, and workout data pulled from your WHOOP
                account to enrich your own training view.
              </li>
              <li>
                <b>Feedback</b> — anything you submit through the in-app
                feedback form.
              </li>
              <li>
                <b>Usage &amp; technical data</b> — a simple count of the days
                you&apos;ve visited, and standard server logs (including IP
                address) kept by our hosting provider. We run{" "}
                <b>no analytics SDKs, ad trackers, or tracking pixels</b>.
              </li>
              <li>
                <b>API keys</b> — if you create developer API keys, we store
                only a cryptographic hash of them.
              </li>
            </ul>
          </Section>

          <Section title="How we use it, and on what basis">
            To run the app you signed up for (performing our contract with
            you): showing your logbook and stats, powering the AI Coach,
            letting you share sessions with people you choose, and — if
            connected — correlating WHOOP metrics with your training (with
            your consent, revocable in Settings). We also use limited data to
            keep the service secure and prevent abuse (legitimate interest —
            e.g. rate limits). We do <b>not</b> sell your data and do not use
            it for advertising.
          </Section>

          <Section title="The AI Coach">
            FlowRoll&apos;s Coach and weekly recap are powered by AI (Claude, from
            Anthropic). When you use them, your messages and relevant training
            context — session summaries and, if connected, WHOOP metrics — are
            sent to Anthropic&apos;s API to generate the response. Your
            conversations are stored in our database until you clear them or
            delete your account. Under Anthropic&apos;s commercial terms, API
            inputs and outputs are <b>not used to train their models</b>;
            Anthropic may retain them briefly (up to about 30 days) for abuse
            monitoring. Coach responses are AI-generated and are not medical
            advice.
          </Section>

          <Section title="Who else touches your data">
            <p className="mb-2">
              Third parties that process user data on our behalf, and why:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <b>Supabase</b> — hosts the database, authentication, and file
                storage.
              </li>
              <li>
                <b>Anthropic</b> — processes Coach messages and recap context,
                as described above.
              </li>
              <li>
                <b>Vercel</b> — hosts and serves the application, including
                standard server logs.
              </li>
              <li>
                <b>WHOOP</b> — the source of your health data, only if you
                connect it; disconnect anytime in Settings.
              </li>
              <li>
                <b>Photon (OpenStreetMap / Komoot)</b> — powers gym-name
                search; your gym search text is sent to their service.
              </li>
              <li>
                <b>Resend</b> — delivers sign-in and service emails.
              </li>
              <li>
                <b>Sentry</b> — error monitoring (technical error reports may
                include your account id), when enabled.
              </li>
              <li>
                <b>YouTube (Google)</b> — technique-video search queries
                (derived from your submission stats, not your identity), when
                enabled.
              </li>
            </ul>
            <p className="mt-2">
              If FlowRoll is ever acquired or merged, user data may transfer
              to the successor under this same policy (we&apos;d notify you). We
              disclose data in response to valid legal requests only when
              required to.
            </p>
          </Section>

          <Section title="What others can see">
            You control your visibility. A public account&apos;s sessions are
            visible to signed-in users; a private account&apos;s sessions are
            visible only to followers you approve. Session photos and videos
            are stored privately and served through short-lived signed links.
            Profile photos are public. Your <b>date of birth is never shown</b>,
            and your <b>WHOOP / health data is never shared</b> with anyone —
            it is visible only to you.
          </Section>

          <Section title="Retention & deletion">
            We keep your data while your account is active. Deleting a
            session, photo, or conversation removes it immediately, including
            the underlying files. Deleting your account (Settings → Danger
            zone) permanently removes your entire footprint — profile,
            sessions, media, conversations, WHOOP data, social activity, and
            API keys — <b>immediately</b>. Copies in our encrypted backups
            expire within 90 days.
          </Section>

          <Section title="Your rights">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <b>Access &amp; export</b> — see everything in the app; export
                your sessions programmatically via{" "}
                <Link href="/developers" className="text-accent hover:underline">
                  the API
                </Link>
                .
              </li>
              <li>
                <b>Correction</b> — edit your profile and sessions anytime.
              </li>
              <li>
                <b>Deletion</b> — in-app, self-serve, immediate (Settings →
                Danger zone).
              </li>
              <li>
                Anything else — email{" "}
                <a
                  href="mailto:christianshields100@gmail.com"
                  className="text-accent hover:underline"
                >
                  christianshields100@gmail.com
                </a>{" "}
                and we&apos;ll respond within 30 days.
              </li>
            </ul>
          </Section>

          <Section title="Children">
            FlowRoll is not directed at children under 13, and you must be at
            least 13 to create an account. If we learn we hold data on a child
            under 13, we will delete it.
          </Section>

          <Section title="Changes & contact">
            If this policy changes materially, we&apos;ll note it here with a
            new effective date. Questions:{" "}
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
            className="text-[11px] uppercase tracking-dojo text-ink-mute hover:text-ink transition-colors"
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
      <h2 className="text-xl font-medium tracking-tightish text-ink">
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
