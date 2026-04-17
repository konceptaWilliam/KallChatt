"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { trpc } from "@/lib/trpc/client";
import { createClient } from "@/lib/supabase/client";

type ThreadStatus = "OPEN" | "URGENT" | "DONE";

type Message = {
  id: string;
  body: string;
  created_at: string;
  user_id: string | null;
  thread_id: string;
  profiles: { id: string; display_name: string; avatar_url: string | null } | null;
};

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function Avatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl?: string | null;
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={name}
        width={28}
        height={28}
        className="w-7 h-7 rounded-sm object-cover flex-shrink-0"
        unoptimized
      />
    );
  }

  return (
    <div className="w-7 h-7 rounded-sm bg-border flex items-center justify-center flex-shrink-0">
      <span className="font-mono text-[10px] font-semibold text-muted">
        {initials}
      </span>
    </div>
  );
}

function StatusControl({
  threadId,
  currentStatus,
}: {
  threadId: string;
  currentStatus: ThreadStatus;
}) {
  const utils = trpc.useUtils();
  const updateStatus = trpc.threads.updateStatus.useMutation({
    onMutate: async () => {
      await utils.threads.list.cancel();
    },
    onSettled: () => {
      utils.threads.list.invalidate();
    },
  });

  const statuses: ThreadStatus[] = ["OPEN", "URGENT", "DONE"];

  return (
    <div className="flex items-center gap-0 border border-border">
      {statuses.map((status) => (
        <button
          key={status}
          onClick={() => {
            if (status !== currentStatus) {
              updateStatus.mutate({ threadId, status });
            }
          }}
          disabled={updateStatus.isPending}
          className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 transition-colors border-r last:border-r-0 border-border ${
            status === currentStatus
              ? status === "URGENT"
                ? "bg-accent text-white"
                : status === "DONE"
                ? "bg-[#065F46] text-white"
                : "bg-ink text-surface"
              : "text-muted hover:text-ink"
          }`}
        >
          {status}
        </button>
      ))}
    </div>
  );
}

export function ThreadDetail({
  threadId,
  groupId,
  initialTitle,
  initialStatus,
}: {
  threadId: string;
  groupId: string;
  initialTitle: string;
  initialStatus: ThreadStatus;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [threadStatus, setThreadStatus] = useState<ThreadStatus>(initialStatus);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const utils = trpc.useUtils();

  // Load messages
  const { data: loadedMessages, isLoading } = trpc.messages.list.useQuery(
    { threadId },
    { refetchOnWindowFocus: false }
  );

  useEffect(() => {
    if (loadedMessages) {
      setMessages(loadedMessages as unknown as Message[]);
    }
  }, [loadedMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime: subscribe to new messages
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`messages:thread:${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `thread_id=eq.${threadId}`,
        },
        async (payload) => {
          const newMsg = payload.new as {
            id: string;
            body: string;
            created_at: string;
            user_id: string;
            thread_id: string;
          };

          // Fetch profile for the new message
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, display_name, avatar_url")
            .eq("id", newMsg.user_id)
            .single();

          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [
              ...prev,
              { ...newMsg, profiles: profile ?? null },
            ];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId]);

  // Realtime: subscribe to thread status updates
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`thread-status:${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "threads",
          filter: `id=eq.${threadId}`,
        },
        (payload) => {
          const updated = payload.new as { status: ThreadStatus };
          setThreadStatus(updated.status);
          utils.threads.list.invalidate({ groupId });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, groupId, utils]);

  const sendMessage = trpc.messages.send.useMutation({
    onSuccess: (msg) => {
      // Message will arrive via Realtime; only append if Realtime isn't firing
      setMessages((prev) => {
        const m = msg as unknown as Message;
        if (prev.some((x) => x.id === m.id)) return prev;
        return [...prev, m];
      });
    },
  });

  function handleSend() {
    if (!body.trim() || sendMessage.isPending) return;
    sendMessage.mutate({ threadId, body: body.trim() });
    setBody("");
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Group messages by date
  const messagesByDate: Array<{ date: string; messages: Message[] }> = [];
  for (const msg of messages) {
    const dateLabel = formatDate(msg.created_at);
    const last = messagesByDate[messagesByDate.length - 1];
    if (last && last.date === dateLabel) {
      last.messages.push(msg);
    } else {
      messagesByDate.push({ date: dateLabel, messages: [msg] });
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full min-w-0">
      {/* Thread header */}
      <div className="px-6 py-3 border-b border-border flex items-center justify-between gap-4 flex-shrink-0">
        <h1 className="font-mono text-sm font-semibold text-ink truncate">
          {initialTitle}
        </h1>
        <StatusControl threadId={threadId} currentStatus={threadStatus} />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="w-7 h-7 bg-border animate-pulse rounded-sm" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-24 bg-border animate-pulse" />
                  <div className="h-4 w-64 bg-border animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-muted font-mono">
              No messages yet. Start the conversation.
            </p>
          </div>
        ) : (
          messagesByDate.map(({ date, messages: dayMessages }) => (
            <div key={date}>
              {/* Date divider */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-border" />
                <span className="font-mono text-[10px] text-muted uppercase tracking-wider">
                  {date}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className="space-y-3">
                {dayMessages.map((msg, idx) => {
                  const prevMsg = idx > 0 ? dayMessages[idx - 1] : null;
                  const isSameAuthor = prevMsg?.user_id === msg.user_id;
                  const name = msg.profiles?.display_name ?? "Unknown";

                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${isSameAuthor ? "mt-0.5" : "mt-3"}`}
                    >
                      <div className="w-7 flex-shrink-0 mt-0.5">
                        {!isSameAuthor && (
                          <Avatar
                            name={name}
                            avatarUrl={msg.profiles?.avatar_url}
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {!isSameAuthor && (
                          <div className="flex items-baseline gap-2 mb-0.5">
                            <span className="text-sm font-semibold text-ink">
                              {name}
                            </span>
                            <span className="font-mono text-[10px] text-muted">
                              {formatTime(msg.created_at)}
                            </span>
                          </div>
                        )}
                        <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap break-words">
                          {msg.body}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Message input */}
      <div className="px-6 py-4 border-t border-border flex-shrink-0">
        {sendMessage.error && (
          <p className="text-xs text-red-600 mb-2">
            {sendMessage.error.message}
          </p>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a message… (Enter to send, Shift+Enter for newline)"
            rows={1}
            className="flex-1 border border-border bg-white px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-ink resize-none transition-colors min-h-[40px] max-h-40 overflow-y-auto"
            style={{
              height: "auto",
              minHeight: "40px",
            }}
            onInput={(e) => {
              const target = e.currentTarget;
              target.style.height = "auto";
              target.style.height = `${Math.min(target.scrollHeight, 160)}px`;
            }}
          />
          <button
            onClick={handleSend}
            disabled={!body.trim() || sendMessage.isPending}
            className="bg-ink text-surface font-mono text-xs font-medium px-4 py-2.5 h-[40px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors flex-shrink-0"
          >
            {sendMessage.isPending ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
