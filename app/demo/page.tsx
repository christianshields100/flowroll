import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { DashboardView } from "@/app/dashboard/DashboardView";
import { loadDemo } from "@/lib/demo";

export const dynamic = "force-dynamic";

// Public, read-only dashboard for a sample athlete. No account needed.
export default async function DemoDashboard() {
  const demo = await loadDemo();
  if (!demo) notFound();
  const { id: _id, ...profile } = demo.profile;
  void _id;
  return (
    <AppShell profile={profile} active="dashboard" demo>
      <DashboardView
        profile={demo.profile}
        sessions={demo.sessions}
        belts={demo.belts}
        now={new Date()}
        demo
      />
    </AppShell>
  );
}
