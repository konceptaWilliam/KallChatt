import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Resend } from "resend";
import { randomBytes } from "crypto";
import { router, protectedProcedure, adminProcedure, publicProcedure } from "../trpc";
import { createAdminClient } from "@/lib/supabase/admin";

export const invitesRouter = router({
  send: adminProcedure
    .input(
      z.object({
        email: z.string().email(),
        groupIds: z.array(z.string().uuid()).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { supabase, profile } = ctx;
      const admin = createAdminClient();

      // Get workspace name
      const { data: workspace } = await supabase
        .from("workspaces")
        .select("name")
        .eq("id", profile.workspace_id)
        .single();

      const token = randomBytes(32).toString("hex");

      const { data: invite, error } = await admin
        .from("invites")
        .insert({
          workspace_id: profile.workspace_id,
          email: input.email,
          invited_by: profile.id,
          group_ids: input.groupIds,
          token,
        })
        .select()
        .single();

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      // Send invite email via Resend
      const resend = new Resend(process.env.RESEND_API_KEY);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const inviteUrl = `${appUrl}/invite/${token}`;

      try {
        await resend.emails.send({
          from: "Kallchatt <onboarding@resend.dev>",
          to: input.email,
          subject: `You've been invited to ${workspace?.name ?? "a workspace"} on Kallchatt`,
          html: `
            <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; color: #1A1A18;">
              <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">You're invited</h1>
              <p style="color: #6B6A65; margin-bottom: 24px;">
                ${profile.display_name} has invited you to join <strong>${workspace?.name ?? "a workspace"}</strong> on Kallchatt.
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

      return invite;
    }),

  list: adminProcedure.query(async ({ ctx }) => {
    const { supabase, profile } = ctx;

    const { data, error } = await supabase
      .from("invites")
      .select("*, profiles!invites_invited_by_fkey(display_name)")
      .eq("workspace_id", profile.workspace_id)
      .eq("accepted", false)
      .order("created_at", { ascending: false });

    if (error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    }

    return data ?? [];
  }),

  revoke: adminProcedure
    .input(z.object({ inviteId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { profile } = ctx;
      const admin = createAdminClient();

      const { error } = await admin
        .from("invites")
        .delete()
        .eq("id", input.inviteId)
        .eq("workspace_id", profile.workspace_id);

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return { success: true };
    }),

  getByToken: publicProcedure
    .input(z.object({ token: z.string().length(64) }))
    .query(async ({ input }) => {
      const admin = createAdminClient();

      const { data, error } = await admin
        .from("invites")
        .select("*, workspaces(name), profiles!invites_invited_by_fkey(display_name)")
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

      // Fetch invite — must be unaccepted and not expired
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

      // Create group memberships
      const memberships = (invite.group_ids as string[]).map((groupId: string) => ({
        group_id: groupId,
        user_id: profile.id,
      }));

      if (memberships.length > 0) {
        await admin.from("group_memberships").upsert(memberships, {
          onConflict: "group_id,user_id",
          ignoreDuplicates: true,
        });
      }

      // Mark invite as accepted
      await admin
        .from("invites")
        .update({ accepted: true })
        .eq("id", invite.id);

      return { success: true };
    }),
});
