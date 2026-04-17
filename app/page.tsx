import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function RootPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const admin = createAdminClient();

  // Use admin client to bypass RLS for the profile existence check
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("id", user!.id)
    .single();

  if (!profile) {
    redirect("/onboarding");
  }

  const { data: memberships } = await admin
    .from("group_memberships")
    .select("group_id")
    .eq("user_id", user.id)
    .limit(1);

  if (memberships && memberships.length > 0) {
    redirect(`/g/${memberships[0].group_id}`);
  }

  // No groups yet — show empty state
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-center">
        <p className="font-mono text-sm text-muted">
          You&apos;re not in any groups yet.
        </p>
        <p className="text-xs text-muted mt-1">Ask an admin to add you.</p>
      </div>
    </div>
  );
}
