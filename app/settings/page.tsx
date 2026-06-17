import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { BeltStripePicker } from "@/components/BeltStripePicker";
import { GymPicker } from "@/components/GymPicker";
import { displayName } from "@/lib/profile";
import { AvatarUploader } from "@/app/u/[id]/AvatarUploader";
import { updateProfile } from "./actions";

const inputCls =
  "w-full bg-paper border border-paper-line rounded-sm px-3 py-2.5 text-ink placeholder:text-ink-mute focus:outline-none focus:border-accent transition";

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, display_name, first_name, last_name, dob, belt, stripes, avatar_url, home_gym_name, home_gym_place_id",
    )
    .eq("id", user!.id)
    .single();

  return (
    <AppShell profile={profile} active={null}>
      <Link
        href={`/u/${user!.id}`}
        className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute hover:text-accent transition"
      >
        ← Profile
      </Link>
      <h1 className="mt-3 font-display text-4xl tracking-tightish">
        Edit profile
      </h1>
      <div className="belt-rule mt-6 max-w-sm" />

      {/* Photo */}
      <section className="mt-8 flex items-center gap-5">
        <Avatar
          url={profile?.avatar_url}
          name={profile ? displayName(profile) : "?"}
          belt={profile?.belt}
          size="lg"
        />
        <div>
          <AvatarUploader uid={user!.id} />
          <p className="mt-2 font-mono text-[11px] text-ink-mute">
            @{profile?.display_name}
          </p>
        </div>
      </section>

      {/* Name + DoB + belt */}
      <form action={updateProfile} className="mt-8 space-y-7 max-w-2xl">
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="First name">
            <input
              type="text"
              name="first_name"
              defaultValue={profile?.first_name ?? ""}
              placeholder="First"
              className={inputCls}
            />
          </Field>
          <Field label="Last name">
            <input
              type="text"
              name="last_name"
              defaultValue={profile?.last_name ?? ""}
              placeholder="Last"
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Date of birth" hint="Private — never shown on your profile">
          <input
            type="date"
            name="dob"
            defaultValue={profile?.dob ?? ""}
            className={inputCls}
          />
        </Field>

        <Field label="Belt" asDiv>
          <BeltStripePicker
            initialBelt={profile?.belt ?? "white"}
            initialStripes={profile?.stripes ?? 0}
          />
        </Field>

        <Field
          label="Home gym"
          hint="Sorted by distance once you allow location"
          asDiv
        >
          <GymPicker
            nameField="home_gym_name"
            placeIdField="home_gym_place_id"
            initialName={profile?.home_gym_name ?? ""}
            initialPlaceId={profile?.home_gym_place_id ?? ""}
            placeholder="Set your home gym — start typing…"
          />
        </Field>

        <button
          type="submit"
          className="bg-accent text-paper px-6 py-3 rounded-sm font-medium hover:bg-accent-deep transition"
        >
          Save changes
        </button>
      </form>
    </AppShell>
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
