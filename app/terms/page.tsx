import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — FlowRoll",
  description: "The agreement between you and FlowRoll.",
};

// Drafted from the actual product (see COMPLIANCE.md). Not legal advice —
// have a lawyer review before relying on it commercially.
export default function TermsPage() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-ink">
        <div className="mx-auto max-w-3xl px-6 py-5 flex items-center justify-between">
          <Link href="/" className="text-[15px] font-semibold tracking-tightish">
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
          Terms of Service
        </p>
        <h1 className="mt-2 text-[34px] leading-[1.1] font-medium tracking-tightish">
          The fine print
        </h1>
        <p className="mt-2 text-[11px] text-ink-mute">
          Effective date: August 13, 2026
        </p>
        <div className="belt-rule mt-6" />

        <div className="mt-8 space-y-8 text-ink-dim leading-relaxed">
          <Section title="1. Agreement">
            These terms are a contract between you and FlowRoll
            (&quot;we&quot;). By creating an account or using flowroll.xyz or
            its API, you agree to them and to our{" "}
            <Link href="/privacy" className="text-accent hover:underline">
              Privacy Policy
            </Link>
            . If you don&apos;t agree, don&apos;t use the service.
          </Section>

          <Section title="2. Eligibility">
            You must be at least 13 years old to use FlowRoll. We verify this
            against the date of birth you provide, and we delete accounts we
            learn belong to children under 13.
          </Section>

          <Section title="3. Your account">
            Keep your sign-in method (your email account) secure — you&apos;re
            responsible for activity on your account. You can delete your
            account at any time in Settings, which permanently removes your
            data as described in the Privacy Policy.
          </Section>

          <Section title="4. Your content">
            You own what you post — training logs, notes, photos, videos,
            comments. You grant us a limited license to host, display, and
            distribute that content within the service (that&apos;s what makes
            the feed work), which ends when you delete the content or your
            account, except for brief persistence in backups.
            <br />
            <br />
            You&apos;re responsible for what you upload. That means: you have
            the rights to it (no ripped instructionals or other copyrighted
            material), and the people identifiable in your photos and videos
            are okay with you posting them. We may remove content that
            violates these terms.
          </Section>

          <Section title="5. Acceptable use">
            Don&apos;t: harass or threaten other users; impersonate anyone;
            post unlawful content; attempt to access other users&apos; data;
            probe, overload, or disrupt the service; scrape at scale; or use
            the service to spam. You can report content that violates these
            rules with the Report link on any session.
          </Section>

          <Section title="6. Training, the AI Coach, and assumption of risk">
            <b>Brazilian Jiu-Jitsu is an inherently risky physical activity.</b>{" "}
            FlowRoll is a logbook and community, not a coach, doctor, or
            physical therapist. The AI Coach generates automated suggestions
            from your own data and general knowledge — it can be wrong, and it
            is <b>not medical, health, or professional advice</b>. You alone
            decide how to train. To the fullest extent permitted by law, you
            assume all risk arising from your training decisions, including
            decisions informed by anything the service shows you. See a
            qualified professional for injuries and health questions.
          </Section>

          <Section title="7. The API">
            API keys are personal — keep them secret and don&apos;t share
            access. Respect rate limits, don&apos;t use the API to
            circumvent app privacy rules, and don&apos;t resell access. We
            may revoke keys that are abused. The API accesses only your own
            data.
          </Section>

          <Section title="8. Termination">
            You can stop using FlowRoll (or delete your account) anytime. We
            may suspend or terminate accounts that violate these terms, harm
            other users, or create legal risk for the service, with notice
            where practicable.
          </Section>

          <Section title="9. Disclaimers">
            FlowRoll is provided <b>&quot;as is&quot; and &quot;as
            available&quot;</b>, without warranties of any kind, express or
            implied — including fitness for a particular purpose,
            merchantability, and non-infringement. We don&apos;t guarantee the
            service will be uninterrupted, error-free, or that data will never
            be lost (export what you can&apos;t afford to lose).
          </Section>

          <Section title="10. Limitation of liability">
            To the fullest extent permitted by law, we are not liable for
            indirect, incidental, special, consequential, or punitive damages,
            or for personal injury arising from your training. Our total
            liability for any claim relating to the service is capped at the
            greater of $50 or the amounts you paid us in the past 12 months
            (currently: nothing — FlowRoll is free). Some jurisdictions
            don&apos;t allow certain limitations, so parts of this may not
            apply to you.
          </Section>

          <Section title="11. Indemnity">
            If your content or your breach of these terms gets us sued,
            you&apos;ll cover the reasonable costs of dealing with it.
          </Section>

          <Section title="12. Governing law">
            These terms are governed by the laws of the State of New York,
            USA, without regard to conflict-of-law rules. Disputes belong in
            the state or federal courts of New York County.
          </Section>

          <Section title="13. Changes & contact">
            If we change these terms materially, we&apos;ll update the
            effective date here and note it in the app. Continued use after a
            change means acceptance. Questions:{" "}
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
