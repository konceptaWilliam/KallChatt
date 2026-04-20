import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { createAdminClient } from "@/lib/supabase/admin";

const threadStatusSchema = z.enum(["OPEN", "URGENT", "DONE"]);

export const threadsRouter = router({
  list: protectedProcedure
    .input(z.object({ groupId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { supabase, profile } = ctx;

      // Verify user is member of this group
      const { data: membership } = await supabase
        .from("group_memberships")
        .select("id")
        .eq("group_id", input.groupId)
        .eq("user_id", profile.id)
        .single();

      if (!membership) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this group" });
      }

      const { data, error } = await supabase
        .from("threads")
        .select(
          `id, title, status, created_at, updated_at, group_id, created_by,
           messages(body, created_at, user_id, profiles(display_name))`
        )
        .eq("group_id", input.groupId)
        .order("updated_at", { ascending: false })
        .order("created_at", { ascending: false, foreignTable: "messages" })
        .limit(1, { foreignTable: "messages" });

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return data ?? [];
    }),

  create: protectedProcedure
    .input(
      z.object({
        groupId: z.string().uuid(),
        title: z.string().min(1).max(200),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { supabase, profile } = ctx;
      const admin = createAdminClient();

      // Verify membership using user's client (respects RLS)
      const { data: membership } = await supabase
        .from("group_memberships")
        .select("id")
        .eq("group_id", input.groupId)
        .eq("user_id", profile.id)
        .single();

      if (!membership) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const { data, error } = await admin
        .from("threads")
        .insert({
          group_id: input.groupId,
          title: input.title,
          status: "OPEN",
          created_by: profile.id,
        })
        .select()
        .single();

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return data;
    }),

  delete: protectedProcedure
    .input(z.object({ threadId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, profile } = ctx;
      const admin = createAdminClient();

      const { data: thread } = await supabase
        .from("threads")
        .select("group_id")
        .eq("id", input.threadId)
        .single();

      if (!thread) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const { data: membership } = await supabase
        .from("group_memberships")
        .select("id")
        .eq("group_id", thread.group_id)
        .eq("user_id", profile.id)
        .single();

      if (!membership) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const { error } = await admin
        .from("threads")
        .delete()
        .eq("id", input.threadId);

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return { success: true };
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        threadId: z.string().uuid(),
        status: threadStatusSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { supabase, profile } = ctx;
      const admin = createAdminClient();

      // Verify membership using user's client
      const { data: thread } = await supabase
        .from("threads")
        .select("group_id")
        .eq("id", input.threadId)
        .single();

      if (!thread) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const { data: membership } = await supabase
        .from("group_memberships")
        .select("id")
        .eq("group_id", thread.group_id)
        .eq("user_id", profile.id)
        .single();

      if (!membership) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const { data, error } = await admin
        .from("threads")
        .update({ status: input.status, updated_at: new Date().toISOString() })
        .eq("id", input.threadId)
        .select()
        .single();

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return data;
    }),
});
