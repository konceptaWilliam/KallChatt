import { TRPCError } from "@trpc/server";
import { router, adminProcedure } from "../trpc";

export const membersRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    const { supabase, profile } = ctx;

    // Fetch all profiles in the workspace
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("workspace_id", profile.workspace_id)
      .order("created_at", { ascending: true });

    if (error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    }

    // Fetch group memberships for each profile
    const { data: memberships } = await supabase
      .from("group_memberships")
      .select("user_id, group_id, groups(name)")
      .in("user_id", (profiles ?? []).map((p) => p.id));

    const membershipsByUser = (memberships ?? []).reduce<
      Record<string, Array<{ group_id: string; group_name: string }>>
    >((acc, m) => {
      if (!acc[m.user_id]) acc[m.user_id] = [];
      acc[m.user_id].push({
        group_id: m.group_id,
        group_name: (m.groups as unknown as { name: string } | null)?.name ?? "",
      });
      return acc;
    }, {});

    return (profiles ?? []).map((p) => ({
      ...p,
      groups: membershipsByUser[p.id] ?? [],
    }));
  }),
});
