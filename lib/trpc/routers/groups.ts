import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { createAdminClient } from "@/lib/supabase/admin";

async function assertGroupAdmin(groupId: string, userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("group_memberships")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .single();
  if (!data || data.role !== "ADMIN") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Group admin access required" });
  }
}

export const groupsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, profile } = ctx;

    const { data, error } = await supabase
      .from("group_memberships")
      .select("group_id, role, groups(id, name, created_at)")
      .eq("user_id", profile.id);

    if (error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    }

    return (data ?? [])
      .map((m) => ({ ...(m.groups as unknown as { id: string; name: string; created_at: string }), myRole: m.role }))
      .filter((g) => g.id) as Array<{ id: string; name: string; created_at: string; myRole: string }>;
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      const { profile } = ctx;
      const admin = createAdminClient();

      const { data, error } = await admin
        .from("groups")
        .insert({ name: input.name, created_by: profile.id })
        .select()
        .single();

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      await admin.from("group_memberships").insert({
        group_id: data.id,
        user_id: profile.id,
        role: "ADMIN",
      });

      return data;
    }),

  rename: protectedProcedure
    .input(z.object({ groupId: z.string().uuid(), name: z.string().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      await assertGroupAdmin(input.groupId, ctx.profile.id);
      const admin = createAdminClient();

      const { error } = await admin
        .from("groups")
        .update({ name: input.name })
        .eq("id", input.groupId);

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return { success: true };
    }),

  leave: protectedProcedure
    .input(z.object({ groupId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { profile } = ctx;
      const admin = createAdminClient();

      const { error } = await admin
        .from("group_memberships")
        .delete()
        .eq("group_id", input.groupId)
        .eq("user_id", profile.id);

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return { success: true };
    }),

  removeMember: protectedProcedure
    .input(z.object({ groupId: z.string().uuid(), userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertGroupAdmin(input.groupId, ctx.profile.id);
      const admin = createAdminClient();

      const { error } = await admin
        .from("group_memberships")
        .delete()
        .eq("group_id", input.groupId)
        .eq("user_id", input.userId);

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return { success: true };
    }),

  transferAdmin: protectedProcedure
    .input(z.object({ groupId: z.string().uuid(), newAdminId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertGroupAdmin(input.groupId, ctx.profile.id);
      const admin = createAdminClient();

      // Promote new admin
      await admin
        .from("group_memberships")
        .update({ role: "ADMIN" })
        .eq("group_id", input.groupId)
        .eq("user_id", input.newAdminId);

      // Demote current admin
      await admin
        .from("group_memberships")
        .update({ role: "MEMBER" })
        .eq("group_id", input.groupId)
        .eq("user_id", ctx.profile.id);

      return { success: true };
    }),
});
