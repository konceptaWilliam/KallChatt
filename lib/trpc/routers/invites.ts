import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Resend } from "resend";
import { randomBytes } from "crypto";
import { router, protectedProcedure, publicProcedure } from "../trpc";
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

export const invitesRouter = router({
  send: protectedProcedure
    .input(z.object({
      email: z.string().email(),
      groupId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { profile } = ctx;
      await assertGroupAdmin(input.groupId, profile.id);

      const admin = createAdminClient();
      const token = randomBytes(32).toString("hex");

      const { data: invite, error } = await admin
        .from("invites")
        .insert({
          email: input.email,
          invited_by: profile.id,
          group_ids: [input.groupId],
          token,
        })
        .select()
        .single();

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      const resend = new Resend(process.env.RESEND_API_KEY);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const inviteUrl = `${appUrl}/invite/${token}`;

      try {
        await resend.emails.send({
          from: "Kallchatt <onboarding@resend.dev>",
          to: input.email,
          subject: `You've been invited to Kallchatt`,
          html: `
            <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; color: #1A1A18;">
              <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">You're invited</h1>
              <p style="color: #6B6A65; margin-bottom: 24px;">
                ${profile.display_name} has invited you to join <strong>Kallchatt</strong>.
              </p>
              <a href="${inviteUrl}" style="display: inline-block; background: #1A1A18; color: #F7F6F2; padding: 12px 24px; text-decoration: none; font-size: 14px; font-weight: 500;">
                Accept &amp; join
              </a>
              <p style="margin-top: 24px; font-size: 12px; color: #6B6A65;">
                Or copy this link: ${inviteUrl}
              </p>
            </div>
          `,
        });
      } catch {
        // Email failure is non-fatal — invite was created
      }

      return { ...invite, inviteUrl };
    }),

  list: protectedProcedure
    .input(z.object({ groupId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertGroupAdmin(input.groupId, ctx.profile.id);
      const admin = createAdminClient();

      const { data, error } = await admin
        .from("invites")
        .select("*, profiles!invites_invited_by_fkey(display_name)")
        .contains("group_ids", [input.groupId])
        .eq("accepted", false)
        .order("created_at", { ascending: false });

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return data ?? [];
    }),

  revoke: protectedProcedure
    .input(z.object({ inviteId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const admin = createAdminClient();

      const { data: invite } = await admin
        .from("invites")
        .select("group_ids")
        .eq("id", input.inviteId)
        .single();

      if (!invite) throw new TRPCError({ code: "NOT_FOUND" });

      const { data: membership } = await admin
        .from("group_memberships")
        .select("id")
        .eq("user_id", ctx.profile.id)
        .eq("role", "ADMIN")
        .in("group_id", invite.group_ids as string[])
        .limit(1)
        .maybeSingle();

      if (!membership) throw new TRPCError({ code: "FORBIDDEN" });

      await admin.from("invites").delete().eq("id", input.inviteId);

      return { success: true };
    }),

  getByToken: publicProcedure
    .input(z.object({ token: z.string().length(64) }))
    .query(async ({ input }) => {
      const admin = createAdminClient();

      const { data, error } = await admin
        .from("invites")
        .select("*, profiles!invites_invited_by_fkey(display_name)")
        .eq("token", input.token)
        .eq("accepted", false)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (error || !data) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found or already accepted" });
      }

      return data;
    }),

  accept: protectedProcedure
    .input(z.object({ token: z.string().length(64) }))
    .mutation(async ({ ctx, input }) => {
      const { profile } = ctx;
      const admin = createAdminClient();

      const { data: invite, error: fetchError } = await admin
        .from("invites")
        .select("*")
        .eq("token", input.token)
        .eq("accepted", false)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (fetchError || !invite) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found" });
      }

      const memberships = (invite.group_ids as string[]).map((groupId: string) => ({
        group_id: groupId,
        user_id: profile.id,
        role: "MEMBER",
      }));

      if (memberships.length > 0) {
        await admin.from("group_memberships").upsert(memberships, {
          onConflict: "group_id,user_id",
          ignoreDuplicates: true,
        });
      }

      await admin.from("invites").update({ accepted: true }).eq("id", invite.id);

      return { success: true };
    }),
});
