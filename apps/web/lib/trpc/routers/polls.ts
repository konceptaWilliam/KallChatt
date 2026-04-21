import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { createAdminClient } from "@/lib/supabase/admin";

export const pollsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        threadId: z.string().uuid(),
        question: z.string().min(1).max(500),
        options: z.array(z.string().min(1).max(200)).max(20).default([]),
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

      const { data: poll, error: pollErr } = await admin
        .from("polls")
        .insert({ thread_id: input.threadId, question: input.question, created_by: profile.id })
        .select("id")
        .single();
      if (pollErr || !poll) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      if (input.options.length > 0) {
        await admin.from("poll_options").insert(
          input.options.filter(Boolean).map((text) => ({ poll_id: poll.id, text, created_by: profile.id }))
        );
      }

      const [{ data: message, error: msgErr }] = await Promise.all([
        admin
          .from("messages")
          .insert({ thread_id: input.threadId, user_id: profile.id, body: "", poll_id: poll.id })
          .select("id, body, created_at, edited_at, is_deleted, thread_id, user_id, attachments, reply_to_id, poll_id, profiles(id, display_name, avatar_url)")
          .single(),
        admin.from("threads").update({ updated_at: new Date().toISOString() }).eq("id", input.threadId),
      ]);
      if (msgErr || !message) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      return message;
    }),

  addOption: protectedProcedure
    .input(z.object({ pollId: z.string().uuid(), text: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, profile } = ctx;
      const admin = createAdminClient();

      const { data: poll } = await admin.from("polls").select("thread_id").eq("id", input.pollId).single();
      if (!poll) throw new TRPCError({ code: "NOT_FOUND" });

      const { data: thread } = await admin.from("threads").select("group_id").eq("id", poll.thread_id).single();
      if (!thread) throw new TRPCError({ code: "NOT_FOUND" });

      const { data: membership } = await supabase
        .from("group_memberships")
        .select("id")
        .eq("group_id", thread.group_id)
        .eq("user_id", profile.id)
        .single();
      if (!membership) throw new TRPCError({ code: "FORBIDDEN" });

      const { data, error } = await admin
        .from("poll_options")
        .insert({ poll_id: input.pollId, text: input.text, created_by: profile.id })
        .select("id, text")
        .single();
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return data;
    }),

  vote: protectedProcedure
    .input(z.object({ pollOptionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, profile } = ctx;
      const admin = createAdminClient();

      const { data: option } = await admin
        .from("poll_options")
        .select("poll_id")
        .eq("id", input.pollOptionId)
        .single();
      if (!option) throw new TRPCError({ code: "NOT_FOUND" });

      const { data: poll } = await admin.from("polls").select("thread_id").eq("id", option.poll_id).single();
      if (!poll) throw new TRPCError({ code: "NOT_FOUND" });

      const { data: thread } = await admin.from("threads").select("group_id").eq("id", poll.thread_id).single();
      if (!thread) throw new TRPCError({ code: "NOT_FOUND" });

      const { data: membership } = await supabase
        .from("group_memberships")
        .select("id")
        .eq("group_id", thread.group_id)
        .eq("user_id", profile.id)
        .single();
      if (!membership) throw new TRPCError({ code: "FORBIDDEN" });

      const { data: existing } = await admin
        .from("poll_votes")
        .select("id")
        .eq("poll_option_id", input.pollOptionId)
        .eq("user_id", profile.id)
        .maybeSingle();

      if (existing) {
        await admin.from("poll_votes").delete().eq("id", existing.id);
      } else {
        await admin.from("poll_votes").insert({ poll_option_id: input.pollOptionId, user_id: profile.id });
      }

      return { success: true };
    }),
});
