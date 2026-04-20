"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { createClient } from "@/lib/supabase/client";
import { StatusBadge } from "./status-badge";
import { NewThreadDialog } from "./new-thread-dialog";
import { useUnread, getLastSeen, setLastSeen } from "@/lib/unread-context";
import { useMobileSidebar } from "@/lib/mobile-sidebar-context";

type Thread = {
  id: string;
  title: string;
  status: "OPEN" | "URGENT" | "DONE";
  updated_at: string;
  group_id: string;
  messages?: Array<{
    body: string;
    is_deleted?: boolean;
    created_at: string;
    profiles: { display_name: string } | null;
  }>;
};

function formatRelative(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString("en", { month: "short", day: "numeric" });
}

function sortThreads(threads: Thread[]): Thread[] {
  return [...threads].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

function UnreadPrism({ isUrgent }: { isUrgent: boolean }) {
  return (
    <span
      className="inline-block w-2 h-2 flex-shrink-0"
      style={{
        background: isUrgent ? "hsl(0 75% 52%)" : "hsl(0 70% 78%)",
        border: `1px solid ${isUrgent ? "hsl(0 65% 38%)" : "hsl(0 50% 62%)"}`,
        transform: "rotate(45deg)",
      }}
    />
  );
}

export function ThreadList({ groupId, groupName }: { groupId: string; groupName: string }) {
  const pathname = usePathname();
  const [showNewThread, setShowNewThread] = useState(false);
  const utils = trpc.useUtils();
  const { threadCounts, setThreadCount } = useUnread();
  const { open: openSidebar } = useMobileSidebar();

  // On mobile, hide thread list when a thread is open so the detail takes full width
  const isOnThread = /\/t\//.test(pathname);

  const { data: rawThreads = [], isLoading } = trpc.threads.list.useQuery(
    { groupId },
    { refetchOnWindowFocus: false }
  );

  const threads = rawThreads as unknown as Thread[];
  const sorted = useMemo(() => sortThreads(threads), [threads]);

  // Calculate and push unread counts whenever thread data changes
  useEffect(() => {
    if (threads.length === 0) return;

    const now = Date.now();

    for (const thread of threads) {
      // If never seen, initialise lastSeen to now so old messages aren't counted
      const lastSeen = getLastSeen(thread.id);
      if (lastSeen === 0) {
        setLastSeen(thread.id, now);
        setThreadCount(thread.id, groupId, 0);
        continue;
      }

      const unread = (thread.messages ?? []).filter(
        (m) => new Date(m.created_at).getTime() > lastSeen
      ).length;

      setThreadCount(thread.id, groupId, unread, thread.status === "URGENT");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawThreads, groupId]);

  // Realtime: invalidate thread list on any change (new messages update thread.updated_at)
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`threads:group:${groupId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "threads", filter: `group_id=eq.${groupId}` },
        () => { utils.threads.list.invalidate({ groupId }); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId, utils]);

  return (
    <section
      className={`${
        isOnThread ? "hidden md:flex" : "flex"
      } flex-col w-full md:w-[336px] flex-shrink-0 border-r border-border h-full`}
    >
      {/* Header */}
      <header className="px-3 md:px-[18px] pt-2 md:pt-[14px] pb-2 md:pb-[10px] border-b border-border">
        <div className="flex items-center gap-1">
          {/* Hamburger - mobile only */}
          <button
            onClick={openSidebar}
            className="md:hidden -ml-1 w-11 h-11 flex items-center justify-center text-muted hover:text-ink transition-colors flex-shrink-0"
            aria-label="Open menu"
          >
            <svg width="18" height="14" viewBox="0 0 18 14" fill="currentColor" aria-hidden="true">
              <rect width="18" height="2" rx="1" />
              <rect y="6" width="18" height="2" rx="1" />
              <rect y="12" width="18" height="2" rx="1" />
            </svg>
          </button>

          <span className="font-mono text-sm font-semibold text-ink flex-1 truncate min-w-0">
            <span className="text-muted-2">· </span>{groupName}
          </span>

          <button
            onClick={() => setShowNewThread(true)}
            className="font-mono text-[11px] px-2.5 py-2 md:py-1 border border-pastel-deep text-pastel-ink transition-all duration-150 hover:-translate-y-px flex-shrink-0 min-h-[44px] md:min-h-0 flex items-center"
            style={{ background: "var(--pastel)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 0 var(--pastel-deep)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
          >
            + new thread
          </button>
        </div>
      </header>

      {/* Thread items */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[80px] bg-border/40 animate-pulse" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-muted font-mono">nothing here yet</p>
          </div>
        ) : (
          sorted.map((thread, i) => {
            const href = `/g/${groupId}/t/${thread.id}`;
            const isActive = pathname === href;
            const isDone = thread.status === "DONE";
            const lastMessage = thread.messages?.[thread.messages.length - 1];
            const lastAuthor = lastMessage?.profiles?.display_name?.split(" ")[0];
            const unread = isActive ? 0 : (threadCounts[thread.id] ?? 0);

            const borderLeftColor = isActive ? "var(--pastel-deep)" : "transparent";

            return (
              <Link
                key={thread.id}
                href={href}
                className={`block py-3 border-b border-border transition-colors duration-150 ${
                  isDone ? "opacity-35" : ""
                } ${isActive ? "bg-pastel-tint/60" : "hover:bg-border/30"}`}
                style={{
                  borderLeft: `3px solid ${borderLeftColor}`,
                  paddingLeft: "15px",
                  paddingRight: "18px",
                  animation: `fadeUp 360ms ${i * 30}ms both ease-out`,
                }}
              >
                {/* Title + unread badge + timestamp */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span
                    className={`font-mono text-[13px] leading-snug truncate ${
                      isDone ? "line-through decoration-muted-2 text-muted" : ""
                    } ${unread > 0 ? "font-semibold" : isActive ? "font-semibold" : "font-medium"}`}
                  >
                    <span className="text-muted-2"># </span>
                    {thread.title}
                  </span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {unread > 0 && <UnreadPrism isUrgent={thread.status === "URGENT"} />}
                    <span className="font-mono text-[10px] text-muted">
                      {formatRelative(thread.updated_at)}
                    </span>
                  </div>
                </div>

                {/* Status pill */}
                <div className="flex items-center gap-2 mb-1.5">
                  <StatusBadge status={thread.status} />
                </div>

                {/* Last message preview */}
                {lastMessage && (
                  <div className="flex items-center gap-1.5 min-w-0">
                    {lastMessage.is_deleted ? (
                      <span className="text-xs text-muted-2 italic">deleted message</span>
                    ) : (
                      <>
                        {lastAuthor && (
                          <span className="font-mono text-[10px] text-muted flex-shrink-0">
                            {lastAuthor}:
                          </span>
                        )}
                        <span className="text-xs text-muted truncate">{lastMessage.body}</span>
                      </>
                    )}
                  </div>
                )}
              </Link>
            );
          })
        )}
      </div>

      {showNewThread && (
        <NewThreadDialog groupId={groupId} onClose={() => setShowNewThread(false)} />
      )}
    </section>
  );
}
