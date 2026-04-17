import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const inviteToken = searchParams.get("inviteToken");

  const supabase = await createClient();

  // Exchange code for session (may fail if already signed in — that's fine)
  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not authenticated at all → back to login
  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const admin = createAdminClient();

  // Check if profile exists
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    // New user — send to onboarding, preserving the invite token if present
    const onboardingUrl = new URL(`${origin}/onboarding`);
    if (inviteToken) onboardingUrl.searchParams.set("invite", inviteToken);
    return NextResponse.redirect(onboardingUrl.toString());
  }

  // Existing user — if there's an invite token, accept it now
  if (inviteToken) {
    const { data: invite } = await admin
      .from("invites")
      .select("*")
      .eq("token", inviteToken)
      .eq("accepted", false)
      .single();

    if (invite) {
      const memberships = (invite.group_ids as string[]).map((groupId: string) => ({
        group_id: groupId,
        user_id: user.id,
      }));

      if (memberships.length > 0) {
        await admin.from("group_memberships").upsert(memberships, {
          onConflict: "group_id,user_id",
          ignoreDuplicates: true,
        });
      }

      await admin.from("invites").update({ accepted: true }).eq("id", invite.id);
    }
  }

  return NextResponse.redirect(`${origin}/`);
}
