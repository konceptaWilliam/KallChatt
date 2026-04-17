import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { createAdminClient } from "@/lib/supabase/admin";

export const groupsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, profile } = ctx;

    // Get groups the user is a member of
    const { data, error } = await supabase
      .from("group_memberships")
      .select("group_id, groups(id, name, created_at, workspace_id)")
      .eq("user_id", profile.id);

    if (error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    }

    return (data ?? [])
      .map((m) => m.groups)
      .filter(Boolean) as unknown as Array<{
        id: string;
        name: string;
        created_at: string;
        workspace_id: string;
      }>;
  }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(80),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { profile } = ctx;
      const admin = createAdminClient();

      const { data, error } = await admin
        .from("groups")
        .insert({
          name: input.name,
          workspace_id: profile.workspace_id,
          created_by: profile.id,
        })
        .select()
        .single();

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      // Add creator as member
      await admin.from("group_memberships").insert({
        group_id: data.id,
        user_id: profile.id,
      });

      return data;
    }),
});
