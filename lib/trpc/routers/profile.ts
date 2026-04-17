import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { createAdminClient } from "@/lib/supabase/admin";

export const profileRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const { profile } = ctx;
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("profiles")
      .select("id, display_name, email, avatar_url, role")
      .eq("id", profile.id)
      .single();

    if (error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    }

    return data;
  }),

  update: protectedProcedure
    .input(
      z.object({
        displayName: z.string().min(1).max(60).optional(),
        avatarUrl: z.string().url().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { profile } = ctx;
      const admin = createAdminClient();

      const updates: Record<string, unknown> = {};
      if (input.displayName !== undefined) updates.display_name = input.displayName;
      if (input.avatarUrl !== undefined) updates.avatar_url = input.avatarUrl;

      const { data, error } = await admin
        .from("profiles")
        .update(updates)
        .eq("id", profile.id)
        .select("id, display_name, email, avatar_url, role")
        .single();

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return data;
    }),
});
