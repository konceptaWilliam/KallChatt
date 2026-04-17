import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../trpc";
import { createAdminClient } from "@/lib/supabase/admin";

export const onboardingRouter = router({
  complete: publicProcedure
    .input(
      z.object({
        displayName: z.string().min(1).max(60),
        inviteToken: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Require an authenticated user
      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const admin = createAdminClient();
      const userId = ctx.user.id;
      const email = ctx.user.email ?? "";

      // Check if profile already exists
      const { data: existing } = await admin
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .single();

      if (existing) {
        return { success: true };
      }

      let workspaceId: string;
      let role: "ADMIN" | "MEMBER" = "ADMIN";

      if (input.inviteToken) {
        // Look up invite to find the workspace
        const { data: invite } = await admin
          .from("invites")
          .select("*")
          .eq("token", input.inviteToken)
          .eq("accepted", false)
          .single();

        if (invite) {
          workspaceId = invite.workspace_id;
          role = "MEMBER";
        } else {
          // Invite not found or already used — create own workspace
          const { data: ws, error } = await admin
            .from("workspaces")
            .insert({ name: `${input.displayName}'s workspace` })
            .select()
            .single();
          if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
          workspaceId = ws.id;
        }
      } else {
        // No invite — create a new workspace
        const { data: ws, error } = await admin
          .from("workspaces")
          .insert({ name: `${input.displayName}'s workspace` })
          .select()
          .single();
        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        workspaceId = ws.id;
      }

      // Create profile
      const { error: profileError } = await admin.from("profiles").insert({
        id: userId,
        workspace_id: workspaceId,
        display_name: input.displayName,
        email,
        role,
      });

      if (profileError) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: profileError.message });
      }

      // Accept invite and create group memberships if applicable
      if (input.inviteToken) {
        const { data: invite } = await admin
          .from("invites")
          .select("*")
          .eq("token", input.inviteToken)
          .eq("accepted", false)
          .single();

        if (invite) {
          const memberships = (invite.group_ids as string[]).map((groupId: string) => ({
            group_id: groupId,
            user_id: userId,
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

      return { success: true };
    }),
});
