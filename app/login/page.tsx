"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "sending" | "sent" | "error";

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const urlError = params.get("error");

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errMsg, setErrMsg] = useState<string | null>(
    urlError === "auth" ? "Sign-in link expired or invalid. Try again." : null,
  );

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setStatus("error");
      setErrMsg(error.message);
    } else {
      setStatus("sent");
    }
  }

  async function signInWithGoogle() {
    setErrMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) setErrMsg(error.message);
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-10">
        <Link
          href="/"
          className="font-display text-2xl tracking-tightish hover:text-accent transition"
        >
          flowroll
        </Link>
        <p className="font-mono text-xs uppercase tracking-dojo text-ink-mute mt-3">
          Step on the mat
        </p>
      </div>

      <div className="bg-paper-raised border border-paper-line rounded-sm p-7 shadow-paper">
        {status === "sent" ? (
          <div className="text-center py-4">
            <div className="belt-rule mb-6" />
            <p className="font-display text-xl tracking-tightish">Check your email</p>
            <p className="mt-3 text-sm text-ink-dim leading-relaxed">
              We sent a sign-in link to{" "}
              <span className="text-ink">{email}</span>. Click it to come back here.
            </p>
            <button
              onClick={() => {
                setStatus("idle");
                setEmail("");
              }}
              className="mt-6 font-mono text-xs uppercase tracking-dojo text-ink-mute hover:text-accent transition"
            >
              ← Use a different email
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-3 bg-paper border border-ink text-ink px-4 py-3 rounded-sm font-medium hover:bg-paper-ink transition"
            >
              <GoogleGlyph />
              Continue with Google
            </button>

            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-paper-line" />
              <span className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute">
                or
              </span>
              <div className="flex-1 h-px bg-paper-line" />
            </div>

            <form onSubmit={sendMagicLink} className="space-y-4">
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute">
                  Email
                </span>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@gym.com"
                  className="mt-2 w-full bg-paper border border-paper-line rounded-sm px-3 py-2.5 text-ink placeholder:text-ink-mute focus:outline-none focus:border-accent transition"
                />
              </label>

              <button
                type="submit"
                disabled={status === "sending" || !email}
                className="w-full bg-accent text-paper px-4 py-3 rounded-sm font-medium hover:bg-accent-deep transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === "sending" ? "Sending…" : "Email me a link"}
              </button>

              {errMsg && (
                <p className="text-sm text-accent mt-2">{errMsg}</p>
              )}
            </form>
          </>
        )}
      </div>

      <p className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute text-center mt-6">
        No passwords. Ever.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <Suspense
        fallback={
          <div className="font-mono text-xs text-ink-mute">Loading…</div>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}
