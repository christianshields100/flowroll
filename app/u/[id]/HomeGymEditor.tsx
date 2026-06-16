"use client";

import { useFormStatus } from "react-dom";
import { GymPicker } from "@/components/GymPicker";
import { setHomeGym } from "./actions";

// Own-profile control for setting your home gym (same picker as the log form).
export function HomeGymEditor({
  name,
  placeId,
}: {
  name: string | null;
  placeId: string | null;
}) {
  return (
    <form action={setHomeGym} className="flex flex-col gap-2 w-full max-w-sm">
      <GymPicker
        nameField="home_gym_name"
        placeIdField="home_gym_place_id"
        initialName={name ?? ""}
        initialPlaceId={placeId ?? ""}
        placeholder="Set your home gym — start typing…"
      />
      <SaveButton />
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start font-mono text-[10px] uppercase tracking-dojo px-3 py-1.5 rounded-sm bg-accent text-paper hover:bg-accent-deep transition disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save home gym"}
    </button>
  );
}
