"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useEffect, useRef, useState } from "react";
import type { SessionRow } from "@/lib/stats";
import { TagInput } from "@/components/TagInput";
import { logSession, updateSession, type LogActionState } from "./actions";

const initialState: LogActionState = { status: "idle" };

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function LogForm({
  defaultGym,
  subSuggestions,
  partnerSuggestions,
  editSession = null,
}: {
  defaultGym: string | null;
  subSuggestions: string[];
  partnerSuggestions: string[];
  // When set, the form edits this session instead of creating a new one.
  editSession?: SessionRow | null;
}) {
  const editing = editSession !== null;
  const [state, formAction] = useFormState(
    editing ? updateSession : logSession,
    initialState,
  );
  const [feel, setFeel] = useState<number>(editSession?.feel ?? 3);
  const formRef = useRef<HTMLFormElement>(null);

  // Edit mode redirects server-side; this reset only applies to new entries.
  useEffect(() => {
    if (state.status !== "ok" || editing) return;
    formRef.current?.reset();
    setFeel(3);
  }, [state, editing]);

  return (
    <form ref={formRef} action={formAction} className="space-y-7 max-w-2xl">
      {editing && (
        <input type="hidden" name="session_id" value={editSession.id} />
      )}
      <div className="grid sm:grid-cols-3 gap-5">
        <Field label="Date">
          <input
            type="date"
            name="trained_on"
            required
            defaultValue={editSession?.trained_on ?? todayISO()}
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
            defaultValue={editSession?.duration_min ?? ""}
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
            defaultValue={editSession?.rounds ?? ""}
            className={inputCls}
          />
        </Field>
      </div>

      <Field label="Gym">
        <input
          type="text"
          name="gym"
          defaultValue={editSession ? (editSession.gym ?? "") : (defaultGym ?? "")}
          placeholder="Where you trained"
          className={inputCls}
        />
      </Field>

      <Field label="What you drilled">
        <textarea
          name="drilled"
          rows={2}
          placeholder="Triangle setups from closed guard, kimura escapes…"
          defaultValue={editSession?.drilled ?? ""}
          className={`${inputCls} resize-y`}
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-5">
        <Field label="Submissions hit" hint="Type to search, Enter to add" asDiv>
          <TagInput
            name="subs_hit"
            suggestions={subSuggestions}
            placeholder="triangle, RNC, kimura…"
            initial={editSession?.subs_hit ?? []}
            accent
          />
        </Field>
        <Field label="Caught in" hint="Type to search, Enter to add" asDiv>
          <TagInput
            name="subs_caught_in"
            suggestions={subSuggestions}
            placeholder="armbar, bow and arrow…"
            initial={editSession?.subs_caught_in ?? []}
          />
        </Field>
      </div>

      <Field label="Training partners" hint="Who you rolled with" asDiv>
        <TagInput
          name="partners"
          suggestions={partnerSuggestions}
          placeholder="Dave, Maria…"
          initial={editSession?.partners ?? []}
          accent
        />
      </Field>

      <Field label="How'd it feel?">
        <FeelPicker value={feel} onChange={setFeel} />
        <input type="hidden" name="feel" value={feel} />
      </Field>

      <Field label="Note">
        <textarea
          name="note"
          rows={3}
          placeholder="Anything worth remembering — what worked, what didn't."
          defaultValue={editSession?.note ?? ""}
          className={`${inputCls} resize-y`}
        />
      </Field>

      <div className="flex items-center gap-4 pt-2">
        <SubmitButton editing={editing} />
        {editing && (
          <a
            href="/dashboard"
            className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute hover:text-accent transition"
          >
            Cancel
          </a>
        )}
        {state.status === "ok" && !editing && (
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

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-accent text-paper px-6 py-3 rounded-sm font-medium hover:bg-accent-deep transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "Saving…" : editing ? "Save changes" : "Log session"}
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
  asDiv = false,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  // TagInput manages its own focus and contains buttons — wrapping it in a
  // <label> would re-route clicks, so those fields render as a <div>.
  asDiv?: boolean;
}) {
  const Tag = asDiv ? "div" : "label";
  return (
    <Tag className="block">
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
    </Tag>
  );
}

const inputCls =
  "w-full bg-paper border border-paper-line rounded-sm px-3 py-2.5 text-ink placeholder:text-ink-mute focus:outline-none focus:border-accent transition";
