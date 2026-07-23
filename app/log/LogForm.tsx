"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useEffect, useRef, useState } from "react";
import type { SessionRow } from "@/lib/stats";
import { TagInput } from "@/components/TagInput";
import { GymPicker } from "@/components/GymPicker";
import { MediaUploader } from "@/components/MediaUploader";
import { logSession, updateSession, type LogActionState } from "./actions";

const initialState: LogActionState = { status: "idle" };

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function LogForm({
  uid,
  defaultGym,
  defaultGymPlaceId,
  subSuggestions,
  partnerSuggestions,
  editSession = null,
  prefillDate,
  prefillMinutes,
  entryNo,
}: {
  uid: string;
  defaultGym: string | null;
  defaultGymPlaceId: string | null;
  subSuggestions: string[];
  partnerSuggestions: string[];
  // When set, the form edits this session instead of creating a new one.
  editSession?: SessionRow | null;
  // From a WHOOP "log this workout" nudge — prefill date/duration for a new entry.
  prefillDate?: string;
  prefillMinutes?: number;
  // Ordinal of this entry in the athlete's archive (for the submit-row copy).
  entryNo?: number;
}) {
  const editing = editSession !== null;
  const [state, formAction] = useFormState(
    editing ? updateSession : logSession,
    initialState,
  );
  const [feel, setFeel] = useState<number>(editSession?.feel ?? 3);
  // Remounts MediaUploader (clearing its internal list) after a save.
  const [mediaKey, setMediaKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  // Edit mode redirects server-side; this reset only applies to new entries.
  useEffect(() => {
    if (state.status !== "ok" || editing) return;
    formRef.current?.reset();
    setFeel(3);
    setMediaKey((k) => k + 1);
  }, [state, editing]);

  return (
    <form ref={formRef} action={formAction} className="space-y-8">
      {editing && (
        <input type="hidden" name="session_id" value={editSession.id} />
      )}
      <div className="grid sm:grid-cols-3 gap-5">
        <Field label="Date">
          <input
            type="date"
            name="trained_on"
            required
            defaultValue={editSession?.trained_on ?? prefillDate ?? todayISO()}
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
            defaultValue={editSession?.duration_min ?? prefillMinutes ?? ""}
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

      <Field label="Gym" hint="Pick from the list to standardize it" asDiv>
        <GymPicker
          key={editSession?.id ?? "new"}
          initialName={editSession ? (editSession.gym ?? "") : (defaultGym ?? "")}
          initialPlaceId={
            editSession
              ? (editSession.gym_place_id ?? "")
              : (defaultGymPlaceId ?? "")
          }
          placeholder="Where you trained — start typing…"
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
          placeholder="Anything worth remembering — what worked, what didn't…"
          defaultValue={editSession?.note ?? ""}
          className={`${inputCls} resize-y`}
        />
      </Field>

      <Field label="Photos / video" hint="Shows on your session in the feed" asDiv>
        <MediaUploader
          key={mediaKey}
          uid={uid}
          initialUrls={editSession?.media_urls ?? []}
        />
      </Field>

      <div className="border-t border-ink pt-5 flex items-center justify-between gap-4 flex-wrap">
        <span className="text-[13px] italic text-ink-mute">
          {editing
            ? "Amendments are part of the record too."
            : entryNo
              ? `Entry Nº ${entryNo} of a lifetime archive.`
              : "One entry at a time."}
        </span>
        <span className="flex items-center gap-4">
          {state.status === "ok" && !editing && (
            <span className="text-[13px] text-accent">✓ Filed</span>
          )}
          {state.status === "error" && (
            <span className="text-sm text-accent">{state.message}</span>
          )}
          {editing && (
            <a
              href="/dashboard"
              className="text-[13px] text-ink-mute hover:text-ink transition-colors"
            >
              Cancel
            </a>
          )}
          <SubmitButton editing={editing} />
        </span>
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
      className="bg-ink text-paper px-7 py-3 text-[13px] font-semibold hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "Filing…" : editing ? "File the amendment →" : "File this session →"}
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
  const captions = [
    "rough seas",
    "a bit off",
    "fair conditions",
    "good day at the office",
    "locked in",
  ];
  return (
    <div className="flex items-center gap-2.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = value === n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={
              active
                ? "h-[34px] w-[34px] rounded-full border-2 border-accent text-accent font-semibold text-sm"
                : "h-[34px] w-[34px] rounded-full border border-paper-input text-ink-dim hover:border-ink hover:text-ink transition-colors text-sm"
            }
            aria-label={`Feel ${n}: ${captions[n - 1]}`}
          >
            {n}
          </button>
        );
      })}
      <span className="ml-3 text-[13px] italic text-ink-mute">
        {captions[value - 1]}
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
        <span className="text-[11px] uppercase tracking-dojo text-ink-mute">
          {label}
        </span>
        {hint && (
          <span className="text-[11px] italic text-ink-mute lowercase">
            {hint}
          </span>
        )}
      </span>
      <span className="block mt-2">{children}</span>
    </Tag>
  );
}

const inputCls =
  "w-full bg-transparent border-0 border-b border-ink px-0 py-2 text-[15px] text-ink placeholder:italic placeholder:text-ink-mute focus:outline-none focus:border-b-accent transition-colors";
