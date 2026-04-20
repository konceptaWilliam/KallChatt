import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "gif", "webp",
  "mp3", "wav", "ogg", "m4a", "aac", "flac",
]);

// Matches: /storage/v1/object/public/attachments/<uuid>/<filename>.<ext>
const ATTACHMENT_PATH_RE = new RegExp(
  `^/storage/v1/object/public/attachments/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+\\.([a-z0-9]+)$`,
  "i"
);

function validateAttachmentUrl(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url);
    const supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname;
    if (hostname !== supabaseHost) return false;
    const match = ATTACHMENT_PATH_RE.exec(pathname);
    if (!match) return false;
    const ext = match[1].toLowerCase();
    return ALLOWED_EXTENSIONS.has(ext);
  } catch {
    return false;
  }
}

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
        .select("id, body, created_at, edited_at, is_deleted, thread_id, user_id, attachments, reply_to_id, profiles(id, display_name, avatar_url)")
        .eq("thread_id", input.threadId)
        .order("created_at", { ascending: false })
        .limit(input.limit);

      if (input.cursor) {
        query = query.lt("created_at", input.cursor);
      }

      const { data, error } = await query;
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      const rows = data ?? [];
      const messageIds = rows.map((m) => m.id);

      const reactionRows =
        messageIds.length > 0
          ? ((await admin
              .from("message_reactions")
              .select("message_id, user_id, type")
              .in("message_id", messageIds)).data ?? [])
          : [];

      // Fetch reply_to info for messages that are replies
      const replyToIdSet = new Set(rows.filter((m) => m.reply_to_id).map((m) => m.reply_to_id!));
      const replyToIds = Array.from(replyToIdSet);
      const replyToData =
        replyToIds.length > 0
          ? ((await admin
              .from("messages")
              .select("id, body, profiles(display_name)")
              .in("id", replyToIds)).data ?? [])
          : [];

      const replyToMap = new Map(
        replyToData.map((m) => [
          m.id,
          {
            id: m.id,
            body: (m.body as string).slice(0, 120),
            author_name:
              (m.profiles as unknown as { display_name: string } | null)?.display_name ?? "Unknown",
          },
        ])
      );

      const messages = [...rows].reverse().map((m) => ({
        ...m,
        reply_to: m.reply_to_id ? (replyToMap.get(m.reply_to_id) ?? null) : null,
        reactions: REACTION_TYPES.map((type) => {
          const users = reactionRows.filter((r) => r.message_id === m.id && r.type === type);
          return { type, count: users.length, userReacted: users.some((r) => r.user_id === profile.id) };
        }),
      }));

      return { messages, hasMore: rows.length === input.limit };
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
          replyToId: z.string().uuid().optional(),
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

      for (const att of input.attachments) {
        if (!validateAttachmentUrl(att.url)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Invalid attachment URL: ${att.name}` });
        }
      }

      const [{ data, error }] = await Promise.all([
        admin
          .from("messages")
          .insert({
            thread_id: input.threadId,
            user_id: profile.id,
            body: input.body,
            attachments: input.attachments,
            reply_to_id: input.replyToId ?? null,
          })
          .select("id, body, created_at, edited_at, is_deleted, thread_id, user_id, attachments, reply_to_id, profiles(id, display_name, avatar_url)")
          .single(),
        admin
          .from("threads")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", input.threadId),
      ]);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      let reply_to = null;
      if (input.replyToId) {
        const { data: replyMsg } = await admin
          .from("messages")
          .select("id, body, profiles(display_name)")
          .eq("id", input.replyToId)
          .single();
        if (replyMsg) {
          reply_to = {
            id: replyMsg.id,
            body: (replyMsg.body as string).slice(0, 120),
            author_name:
              (replyMsg.profiles as unknown as { display_name: string } | null)?.display_name ?? "Unknown",
          };
        }
      }

      return {
        ...data,
        reply_to,
        reactions: REACTION_TYPES.map((type) => ({ type, count: 0, userReacted: false })),
      };
    }),

  edit: protectedProcedure
    .input(
      z.object({
        messageId: z.string().uuid(),
        body: z.string().min(1).max(10000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { profile } = ctx;
      const admin = createAdminClient();

      const { data: message } = await admin
        .from("messages")
        .select("id, user_id")
        .eq("id", input.messageId)
        .single();

      if (!message) throw new TRPCError({ code: "NOT_FOUND" });
      if (message.user_id !== profile.id) throw new TRPCError({ code: "FORBIDDEN" });

      const now = new Date().toISOString();
      const { data, error } = await admin
        .from("messages")
        .update({ body: input.body, edited_at: now })
        .eq("id", input.messageId)
        .select("id, body, edited_at")
        .single();

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data as { id: string; body: string; edited_at: string };
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

  deleteMessage: protectedProcedure
    .input(z.object({ messageId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { profile } = ctx;
      const admin = createAdminClient();

      const { data: message } = await admin
        .from("messages")
        .select("id, user_id")
        .eq("id", input.messageId)
        .single();

      if (!message) throw new TRPCError({ code: "NOT_FOUND" });
      if (message.user_id !== profile.id) throw new TRPCError({ code: "FORBIDDEN" });

      const { error } = await admin
        .from("messages")
        .update({ is_deleted: true })
        .eq("id", input.messageId);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true };
    }),

  groupMembers: protectedProcedure
    .input(z.object({ groupId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { supabase } = ctx;
      const admin = createAdminClient();

      const { data: membership } = await supabase
        .from("group_memberships")
        .select("id")
        .eq("group_id", input.groupId)
        .eq("user_id", ctx.profile.id)
        .single();

      if (!membership) throw new TRPCError({ code: "FORBIDDEN" });

      const { data } = await admin
        .from("group_memberships")
        .select("profiles(id, display_name)")
        .eq("group_id", input.groupId);

      return ((data ?? [])
        .map((row) => row.profiles as unknown as { id: string; display_name: string } | null)
        .filter(Boolean) as { id: string; display_name: string }[])
        .sort((a, b) => a.display_name.localeCompare(b.display_name));
    }),
});
