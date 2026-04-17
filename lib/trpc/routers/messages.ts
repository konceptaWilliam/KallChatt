import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { createAdminClient } from "@/lib/supabase/admin";

export const messagesRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        threadId: z.string().uuid(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { supabase, profile } = ctx;

      // Verify access using user's client
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

      const admin = createAdminClient();
      let query = admin
        .from("messages")
        .select("id, body, created_at, thread_id, user_id, profiles(id, display_name, avatar_url)")
        .eq("thread_id", input.threadId)
        .order("created_at", { ascending: true })
        .limit(input.limit);

      if (input.cursor) {
        query = query.gt("created_at", input.cursor);
      }

      const { data, error } = await query;

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return data ?? [];
    }),

  send: protectedProcedure
    .input(
      z.object({
        threadId: z.string().uuid(),
        body: z.string().min(1).max(10000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { supabase, profile } = ctx;
      const admin = createAdminClient();

      // Verify access using user's client
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

      const [{ data, error }] = await Promise.all([
        admin
          .from("messages")
          .insert({
            thread_id: input.threadId,
            user_id: profile.id,
            body: input.body,
          })
          .select("id, body, created_at, thread_id, user_id, profiles(id, display_name, avatar_url)")
          .single(),
        admin
          .from("threads")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", input.threadId),
      ]);

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return data;
    }),
});
