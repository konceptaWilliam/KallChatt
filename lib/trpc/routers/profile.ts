import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Resend } from "resend";
import { router, protectedProcedure } from "../trpc";
import { createAdminClient } from "@/lib/supabase/admin";

export const profileRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const { profile } = ctx;
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("profiles")
      .select("id, display_name, email, avatar_url")
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
        .select("id, display_name, email, avatar_url")
        .single();

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return data;
    }),

  sendPasswordChangedEmail: protectedProcedure.mutation(async ({ ctx }) => {
    const { profile } = ctx;
    const resend = new Resend(process.env.RESEND_API_KEY);
    try {
      await resend.emails.send({
        from: "Kallchatt <onboarding@resend.dev>",
        to: profile.email,
        subject: "Your Kallchatt password has been changed",
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; color: #1A1A18;">
            <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">Password changed</h1>
            <p style="color: #6B6A65; margin-bottom: 24px;">
              Your Kallchatt password was recently changed. If this wasn't you, contact your workspace admin immediately.
            </p>
          </div>
        `,
      });
    } catch {
      // Non-fatal
    }
    return { success: true };
  }),
});
