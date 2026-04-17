import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { createAdminClient } from "@/lib/supabase/admin";

const REACTION_TYPES = ["👍", "👎", "❓"] as const;

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

      const { data: thread } = await supabase
        .from("threads")
        .select("group_id")
        .eq("id", input.threadId)
        .single();

      if (!thread) throw new TRPCError({ code: "NOT_FOUND" });

      const { data: membership } = await supabase
        .from("group_memberships")
        .select("id")
        .eq("group_id", thread.group_id)
        .eq("user_id", profile.id)
        .single();

      if (!membership) throw new TRPCError({ code: "FORBIDDEN" });

      const admin = createAdminClient();
      let query = admin
        .from("messages")
        .select("id, body, created_at, thread_id, user_id, attachments, profiles(id, display_name, avatar_url)")
        .eq("thread_id", input.threadId)
        .order("created_at", { ascending: true })
        .limit(input.limit);

      if (input.cursor) {
        query = query.gt("created_at", input.cursor);
      }

      const { data, error } = await query;
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      const messageIds = (data ?? []).map((m) => m.id);
      const reactionRows =
        messageIds.length > 0
          ? ((await admin
              .from("message_reactions")
              .select("message_id, user_id, type")
              .in("message_id", messageIds)).data ?? [])
          : [];

      return (data ?? []).map((m) => ({
        ...m,
        reactions: REACTION_TYPES.map((type) => {
          const users = reactionRows.filter((r) => r.message_id === m.id && r.type === type);
          return { type, count: users.length, userReacted: users.some((r) => r.user_id === profile.id) };
        }),
      }));
    }),

  send: protectedProcedure
    .input(
      z
        .object({
          threadId: z.string().uuid(),
          body: z.string().max(10000).default(""),
          attachments: z
            .array(
              z.object({
                url: z.string().url(),
                type: z.enum(["image", "audio"]),
                name: z.string(),
              })
            )
            .default([]),
        })
        .refine((d) => d.body.trim().length > 0 || d.attachments.length > 0, {
          message: "Message must have text or attachments",
        })
    )
    .mutation(async ({ ctx, input }) => {
      const { supabase, profile } = ctx;
      const admin = createAdminClient();

      const { data: thread } = await supabase
        .from("threads")
        .select("group_id")
        .eq("id", input.threadId)
        .single();

      if (!thread) throw new TRPCError({ code: "NOT_FOUND" });

      const { data: membership } = await supabase
        .from("group_memberships")
        .select("id")
        .eq("group_id", thread.group_id)
        .eq("user_id", profile.id)
        .single();

      if (!membership) throw new TRPCError({ code: "FORBIDDEN" });

      const [{ data, error }] = await Promise.all([
        admin
          .from("messages")
          .insert({
            thread_id: input.threadId,
            user_id: profile.id,
            body: input.body,
            attachments: input.attachments,
          })
          .select("id, body, created_at, thread_id, user_id, attachments, profiles(id, display_name, avatar_url)")
          .single(),
        admin
          .from("threads")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", input.threadId),
      ]);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      return { ...data, reactions: REACTION_TYPES.map((type) => ({ type, count: 0, userReacted: false })) };
    }),

  toggleReaction: protectedProcedure
    .input(
      z.object({
        messageId: z.string().uuid(),
        type: z.enum(["👍", "👎", "❓"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { supabase, profile } = ctx;
      const admin = createAdminClient();

      // Reading via user client confirms group membership (RLS handles auth)
      const { data: message } = await supabase
        .from("messages")
        .select("id")
        .eq("id", input.messageId)
        .single();

      if (!message) throw new TRPCError({ code: "NOT_FOUND" });

      const { data: existing } = await admin
        .from("message_reactions")
        .select("id")
        .eq("message_id", input.messageId)
        .eq("user_id", profile.id)
        .eq("type", input.type)
        .maybeSingle();

      if (existing) {
        await admin.from("message_reactions").delete().eq("id", existing.id);
      } else {
        await admin.from("message_reactions").insert({
          message_id: input.messageId,
          user_id: profile.id,
          type: input.type,
        });
      }

      return { success: true };
    }),
});
