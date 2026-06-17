"use client";

// Three-step first-time setup. All steps stay mounted (toggled with `hidden`)
// so field values persist; the final step submits the whole form.
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Avatar } from "@/components/Avatar";
import { BeltStripePicker } from "@/components/BeltStripePicker";
import { AvatarUploader } from "@/app/u/[id]/AvatarUploader";
import { completeOnboarding } from "./actions";

const inputCls =
  "w-full bg-paper border border-paper-line rounded-sm px-3 py-2.5 text-ink placeholder:text-ink-mute focus:outline-none focus:border-accent transition";

type Initial = {
  first_name: string;
  last_name: string;
  dob: string;
  belt: string;
  stripes: number;
  avatar_url: string | null;
};

const STEPS = ["You", "Belt", "Photo"];

export function OnboardingWizard({
  uid,
  username,
  initial,
}: {
  uid: string;
  username: string;
  initial: Initial;
}) {
  const [step, setStep] = useState(0);

  return (
    <form action={completeOnboarding}>
      {/* progress bars */}
      <div className="flex gap-2 mb-7">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full ${
              i <= step ? "bg-accent" : "bg-paper-line"
            }`}
          />
        ))}
      </div>

      {/* Step 0 — name + DoB */}
      <div className={step === 0 ? "space-y-5" : "hidden"}>
        <div>
          <h2 className="font-display text-2xl tracking-tightish">
            Welcome to the mat.
          </h2>
          <p className="mt-1 text-sm text-ink-dim">
            What should we call you? This shows on your profile;{" "}
            <span className="font-mono">@{username}</span> stays your handle.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute">
              First name
            </span>
            <input
              name="first_name"
              defaultValue={initial.first_name}
              placeholder="First"
              className={`${inputCls} mt-2`}
            />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute">
              Last name
            </span>
            <input
              name="last_name"
              defaultValue={initial.last_name}
              placeholder="Last"
              className={`${inputCls} mt-2`}
            />
          </label>
        </div>
        <label className="block">
          <span className="flex items-baseline justify-between">
            <span className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute">
              Date of birth
            </span>
            <span className="font-mono text-[10px] text-ink-mute lowercase">
              private — never shown
            </span>
          </span>
          <input
            type="date"
            name="dob"
            defaultValue={initial.dob}
            className={`${inputCls} mt-2`}
          />
        </label>
      </div>

      {/* Step 1 — belt */}
      <div className={step === 1 ? "" : "hidden"}>
        <h2 className="font-display text-2xl tracking-tightish">
          What belt are you?
        </h2>
        <p className="mt-1 text-sm text-ink-dim">You can change this anytime.</p>
        <div className="mt-5">
          <BeltStripePicker
            initialBelt={initial.belt}
            initialStripes={initial.stripes}
          />
        </div>
      </div>

      {/* Step 2 — photo */}
      <div className={step === 2 ? "" : "hidden"}>
        <h2 className="font-display text-2xl tracking-tightish">
          Add a profile photo
        </h2>
        <p className="mt-1 text-sm text-ink-dim">Optional — you can skip this.</p>
        <div className="mt-5 flex items-center gap-5">
          <Avatar
            url={initial.avatar_url}
            name={`${initial.first_name} ${initial.last_name}`.trim() || username}
            size="lg"
          />
          <AvatarUploader uid={uid} />
        </div>
      </div>

      {/* nav */}
      <div className="mt-8 flex items-center justify-between">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute hover:text-accent transition"
          >
            ← Back
          </button>
        ) : (
          <span />
        )}
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="bg-accent text-paper px-5 py-2.5 rounded-sm font-medium hover:bg-accent-deep transition"
          >
            Next →
          </button>
        ) : (
          <FinishButton />
        )}
      </div>
    </form>
  );
}

function FinishButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-accent text-paper px-5 py-2.5 rounded-sm font-medium hover:bg-accent-deep transition disabled:opacity-50"
    >
      {pending ? "Setting up…" : "Finish"}
    </button>
  );
}
