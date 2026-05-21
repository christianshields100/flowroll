"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { logSession, type LogActionState } from "./actions";

const initialState: LogActionState = { status: "idle" };

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function LogForm({ defaultGym }: { defaultGym: string | null }) {
  const [state, formAction] = useFormState(logSession, initialState);
  const [feel, setFeel] = useState<number>(3);
  const formRef = useRef<HTMLFormElement>(null);

  // Reset form on successful save so you can log another session immediately.
  useEffect(() => {
    if (state.status === "ok") {
      formRef.current?.reset();
      setFeel(3);
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-7 max-w-2xl">
      <div className="grid sm:grid-cols-3 gap-5">
        <Field label="Date">
          <input
            type="date"
            name="trained_on"
            required
            defaultValue={todayISO()}
            className={inputCls}
          />
        </Field>
        <Field label="Duration (min)">
          <input
            type="number"
            name="duration_min"
            required
            min={1}
            max={599}
            placeholder="60"
            className={inputCls}
          />
        </Field>
        <Field label="Rounds rolled">
          <input
            type="number"
            name="rounds"
            required
            min={0}
            max={99}
            placeholder="6"
            className={inputCls}
          />
        </Field>
      </div>

      <Field label="Gym">
        <input
          type="text"
          name="gym"
          defaultValue={defaultGym ?? ""}
          placeholder="Where you trained"
          className={inputCls}
        />
      </Field>

      <Field label="What you drilled">
        <textarea
          name="drilled"
          rows={2}
          placeholder="Triangle setups from closed guard, kimura escapes…"
          className={`${inputCls} resize-y`}
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-5">
        <Field label="Submissions hit" hint="Comma-separated">
          <input
            type="text"
            name="subs_hit"
            placeholder="triangle, RNC, kimura"
            className={inputCls}
          />
        </Field>
        <Field label="Caught in" hint="Comma-separated">
          <input
            type="text"
            name="subs_caught_in"
            placeholder="armbar, bow-and-arrow"
            className={inputCls}
          />
        </Field>
      </div>

      <Field label="How'd it feel?">
        <FeelPicker value={feel} onChange={setFeel} />
        <input type="hidden" name="feel" value={feel} />
      </Field>

      <Field label="Note">
        <textarea
          name="note"
          rows={3}
          placeholder="Anything worth remembering — what worked, what didn't, who you rolled with."
          className={`${inputCls} resize-y`}
        />
      </Field>

      <div className="flex items-center gap-4 pt-2">
        <SubmitButton />
        {state.status === "ok" && (
          <span className="font-mono text-xs uppercase tracking-dojo text-accent">
            ✓ Saved
          </span>
        )}
        {state.status === "error" && (
          <span className="text-sm text-accent">{state.message}</span>
        )}
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-accent text-paper px-6 py-3 rounded-sm font-medium hover:bg-accent-deep transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "Saving…" : "Log session"}
    </button>
  );
}

function FeelPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const labels = ["Rough", "Off", "OK", "Sharp", "Locked in"];
  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = value === n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={
              active
                ? "h-10 w-10 rounded-sm bg-accent text-paper font-mono text-sm"
                : "h-10 w-10 rounded-sm bg-paper border border-paper-line text-ink-dim hover:border-accent hover:text-ink transition font-mono text-sm"
            }
            aria-label={`Feel ${n}: ${labels[n - 1]}`}
          >
            {n}
          </button>
        );
      })}
      <span className="ml-3 font-mono text-xs text-ink-mute">
        {labels[value - 1]}
      </span>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute">
          {label}
        </span>
        {hint && (
          <span className="font-mono text-[10px] text-ink-mute lowercase">
            {hint}
          </span>
        )}
      </span>
      <span className="block mt-2">{children}</span>
    </label>
  );
}

const inputCls =
  "w-full bg-paper border border-paper-line rounded-sm px-3 py-2.5 text-ink placeholder:text-ink-mute focus:outline-none focus:border-accent transition";
