"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { createClient } from "@/lib/supabase/client";

type ThreadStatus = "OPEN" | "URGENT" | "DONE";

type Attachment = {
  url: string;
  type: "image" | "audio";
  name: string;
};

type Reaction = {
  type: string;
  count: number;
  userReacted: boolean;
};

const REACTION_DEFAULTS: Reaction[] = [
  { type: "👍", count: 0, userReacted: false },
  { type: "👎", count: 0, userReacted: false },
  { type: "❓", count: 0, userReacted: false },
];

type Message = {
  id: string;
  body: string;
  created_at: string;
  user_id: string | null;
  thread_id: string;
  attachments: Attachment[];
  reactions: Reaction[];
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

function AttachmentModal({
  attachment,
  groupId,
  currentThreadId,
  onClose,
}: {
  attachment: Attachment;
  groupId: string;
  currentThreadId: string;
  onClose: () => void;
}) {
  const [view, setView] = useState<"preview" | "resend">("preview");
  const [sentToThread, setSentToThread] = useState<string | null>(null);

  const { data: threads } = trpc.threads.list.useQuery({ groupId });
  const send = trpc.messages.send.useMutation({
    onSuccess: (_, vars) => {
      setSentToThread(vars.threadId);
      setTimeout(onClose, 1500);
    },
  });

  async function handleDownload() {
    try {
      const res = await fetch(attachment.url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(attachment.url, "_blank");
    }
  }

  const otherThreads = (threads ?? []).filter((t) => t.id !== currentThreadId);

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface w-full max-w-2xl max-h-[90vh] flex flex-col border border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <span className="font-mono text-xs text-muted truncate flex-1 mr-4">
            {attachment.name}
          </span>
          <button
            onClick={onClose}
            className="font-mono text-xl leading-none text-muted hover:text-ink transition-colors"
          >
            ×
          </button>
        </div>

        {/* Content */}
        {view === "preview" ? (
          <div className="flex-1 overflow-auto flex items-center justify-center p-6 min-h-0">
            {attachment.type === "image" ? (
              <img
                src={attachment.url}
                alt={attachment.name}
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
                  <path d="M9 18V5l12-2v13"/>
                  <circle cx="6" cy="18" r="3"/>
                  <circle cx="18" cy="16" r="3"/>
                </svg>
                <span className="font-mono text-sm text-muted">{attachment.name}</span>
                <audio controls src={attachment.url} className="w-full max-w-sm" />
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            <p className="font-mono text-[10px] text-muted uppercase tracking-wider mb-3">
              Send to thread
            </p>
            {sentToThread ? (
              <p className="font-mono text-sm text-ink">Sent!</p>
            ) : otherThreads.length === 0 ? (
              <p className="text-xs text-muted">No other threads in this group.</p>
            ) : (
              <div className="space-y-1">
                {otherThreads.map((thread) => (
                  <button
                    key={thread.id}
                    onClick={() =>
                      send.mutate({
                        threadId: thread.id,
                        body: "",
                        attachments: [attachment],
                      })
                    }
                    disabled={send.isPending}
                    className="w-full text-left px-3 py-2.5 font-mono text-sm text-ink hover:bg-border/40 transition-colors border border-transparent hover:border-border disabled:opacity-40"
                  >
                    # {(thread as unknown as { title: string }).title}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 px-4 py-3 border-t border-border flex-shrink-0">
          {view === "resend" && (
            <button
              onClick={() => setView("preview")}
              className="font-mono text-xs text-muted hover:text-ink transition-colors"
            >
              ← Back
            </button>
          )}
          <div className="flex-1" />
          {view === "preview" && attachment.type === "image" && (
            <button
              onClick={handleDownload}
              className="font-mono text-xs text-muted hover:text-ink transition-colors"
            >
              Download
            </button>
          )}
          {view === "preview" && (
            <button
              onClick={() => setView("resend")}
              className="font-mono text-xs bg-ink text-surface px-3 py-1.5 hover:bg-ink/90 transition-colors"
            >
              Resend
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Avatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl?: string | null;
}) {
  const [imgError, setImgError] = useState(false);

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (avatarUrl && !imgError) {
    return (
      <Image
        src={avatarUrl}
        alt={name}
        width={28}
        height={28}
        className="w-7 h-7 rounded-sm object-cover flex-shrink-0"
        unoptimized
        onError={() => setImgError(true)}
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeLightbox, setActiveLightbox] = useState<Attachment | null>(null);
  const [openReactionPicker, setOpenReactionPicker] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const router = useRouter();

  const deleteThread = trpc.threads.delete.useMutation({
    onSuccess: () => {
      utils.threads.list.invalidate({ groupId });
      router.push(`/g/${groupId}`);
    },
  });

  const toggleReaction = trpc.messages.toggleReaction.useMutation({
    onMutate: ({ messageId, type }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          return {
            ...m,
            reactions: m.reactions.map((r) =>
              r.type !== type
                ? r
                : { ...r, count: r.userReacted ? r.count - 1 : r.count + 1, userReacted: !r.userReacted }
            ),
          };
        })
      );
    },
    onSuccess: () => {
      utils.messages.list.invalidate({ threadId });
    },
    onError: () => {
      utils.messages.list.invalidate({ threadId });
    },
  });

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
            attachments: Attachment[];
          };

          // Fetch profile for the new message
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, display_name, avatar_url")
            .eq("id", newMsg.user_id)
            .single();

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, { ...newMsg, profiles: profile ?? null, reactions: REACTION_DEFAULTS }];
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

  async function uploadFiles(files: File[]): Promise<Attachment[]> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const results: Attachment[] = [];
    for (const file of files) {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("attachments")
        .upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage
        .from("attachments")
        .getPublicUrl(path);
      results.push({
        url: publicUrl,
        type: file.type.startsWith("image/") ? "image" : "audio",
        name: file.name,
      });
    }
    return results;
  }

  async function handleSend() {
    if ((!body.trim() && pendingFiles.length === 0) || sendMessage.isPending || uploading) return;

    setUploading(true);
    setUploadError(null);

    let attachments: Attachment[] = [];
    try {
      if (pendingFiles.length > 0) {
        attachments = await uploadFiles(pendingFiles);
      }
      sendMessage.mutate({ threadId, body: body.trim(), attachments });
      setBody("");
      setPendingFiles([]);
      textareaRef.current?.focus();
    } catch {
      setUploadError("Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setPendingFiles((prev) => [...prev, ...files]);
    e.target.value = "";
  }

  function removePendingFile(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
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
          # {initialTitle}
        </h1>
        <div className="flex items-center gap-3 flex-shrink-0">
          <StatusControl threadId={threadId} currentStatus={threadStatus} />
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-red-600 uppercase tracking-wider">
                Delete?
              </span>
              <button
                onClick={() => deleteThread.mutate({ threadId })}
                disabled={deleteThread.isPending}
                className="font-mono text-[10px] uppercase tracking-wider px-2 py-1 bg-red-600 text-white disabled:opacity-40"
              >
                {deleteThread.isPending ? "..." : "Confirm"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="font-mono text-[10px] uppercase tracking-wider px-2 py-1 text-muted hover:text-ink transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              title="Delete thread"
              className="text-muted hover:text-red-600 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          )}
        </div>
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
                      className={`flex gap-3 group ${isSameAuthor ? "mt-0.5" : "mt-3"}`}
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
                        <div className="flex items-end gap-1.5 flex-wrap">
                          {msg.body && (
                            <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap break-words">
                              {msg.body}
                            </p>
                          )}
                          <div className="flex items-center gap-1 mb-px flex-shrink-0">
                            <button
                              onClick={() => setOpenReactionPicker(openReactionPicker === msg.id ? null : msg.id)}
                              className={`font-mono text-xs text-muted hover:text-ink transition-opacity ${openReactionPicker === msg.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                            >
                              =)
                            </button>
                            {openReactionPicker === msg.id && (
                              <div className="flex items-center gap-0.5">
                                {(["👍", "👎", "❓"] as const).map((type) => (
                                  <button
                                    key={type}
                                    onClick={() => {
                                      toggleReaction.mutate({ messageId: msg.id, type });
                                      setOpenReactionPicker(null);
                                    }}
                                    className="text-sm hover:scale-125 transition-transform"
                                  >
                                    {type}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        {(msg.attachments ?? []).length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-2">
                            {msg.attachments.map((att, i) =>
                              att.type === "image" ? (
                                <button
                                  key={i}
                                  onClick={() => setActiveLightbox(att)}
                                  className="w-24 h-24 flex-shrink-0 border border-border overflow-hidden hover:opacity-80 transition-opacity"
                                >
                                  <img
                                    src={att.url}
                                    alt={att.name}
                                    className="w-full h-full object-cover"
                                  />
                                </button>
                              ) : (
                                <button
                                  key={i}
                                  onClick={() => setActiveLightbox(att)}
                                  className="flex items-center gap-2 border border-border px-3 py-2 hover:border-ink transition-colors"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted flex-shrink-0">
                                    <path d="M9 18V5l12-2v13"/>
                                    <circle cx="6" cy="18" r="3"/>
                                    <circle cx="18" cy="16" r="3"/>
                                  </svg>
                                  <span className="font-mono text-xs text-ink max-w-[160px] truncate">
                                    {att.name}
                                  </span>
                                </button>
                              )
                            )}
                          </div>
                        )}
                        {/* Reaction pills */}
                        {(msg.reactions ?? []).some((r) => r.count > 0) && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {msg.reactions.filter((r) => r.count > 0).map((r) => (
                              <button
                                key={r.type}
                                onClick={() => toggleReaction.mutate({ messageId: msg.id, type: r.type as "👍" | "👎" | "❓" })}
                                className={`flex items-center gap-1 px-1.5 py-0.5 border font-mono text-xs transition-colors ${
                                  r.userReacted
                                    ? "bg-ink text-surface border-ink"
                                    : "border-border text-muted hover:border-ink hover:text-ink"
                                }`}
                              >
                                <span>{r.type}</span>
                                <span>{r.count}</span>
                              </button>
                            ))}
                          </div>
                        )}
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

      {/* Attachment lightbox */}
      {activeLightbox && (
        <AttachmentModal
          attachment={activeLightbox}
          groupId={groupId}
          currentThreadId={threadId}
          onClose={() => setActiveLightbox(null)}
        />
      )}

      {/* Message input */}
      <div className="px-6 py-4 border-t border-border flex-shrink-0">
        {(sendMessage.error || uploadError) && (
          <p className="text-xs text-red-600 mb-2">
            {uploadError ?? sendMessage.error?.message}
          </p>
        )}

        {/* Pending file previews */}
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {pendingFiles.map((file, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 border border-border bg-white px-2 py-1 text-xs text-ink"
              >
                {file.type.startsWith("image/") ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted flex-shrink-0"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted flex-shrink-0"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                )}
                <span className="max-w-[120px] truncate font-mono">{file.name}</span>
                <button
                  onClick={() => removePendingFile(i)}
                  className="text-muted hover:text-ink transition-colors ml-0.5"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 items-end">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,audio/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach image or audio"
            className="text-muted hover:text-ink transition-colors flex-shrink-0 h-[40px] flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
          </button>
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a message… (Enter to send, Shift+Enter for newline)"
            rows={1}
            className="flex-1 border border-border bg-white px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-ink resize-none transition-colors min-h-[40px] max-h-40 overflow-y-auto"
            style={{ height: "auto", minHeight: "40px" }}
            onInput={(e) => {
              const target = e.currentTarget;
              target.style.height = "auto";
              target.style.height = `${Math.min(target.scrollHeight, 160)}px`;
            }}
          />
          <button
            onClick={handleSend}
            disabled={(!body.trim() && pendingFiles.length === 0) || sendMessage.isPending || uploading}
            className="bg-ink text-surface font-mono text-xs font-medium px-4 py-2.5 h-[40px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors flex-shrink-0"
          >
            {uploading ? "↑" : sendMessage.isPending ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
