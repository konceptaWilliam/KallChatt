"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { createClient } from "@/lib/supabase/client";
import { StatusBadge } from "./status-badge";
import { NewThreadDialog } from "./new-thread-dialog";

type Thread = {
  id: string;
  title: string;
  status: "OPEN" | "URGENT" | "DONE";
  updated_at: string;
  group_id: string;
  messages?: Array<{
    body: string;
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
  const urgentOpen = threads.filter((t) => t.status === "URGENT");
  const open = threads.filter((t) => t.status === "OPEN");
  const done = threads.filter((t) => t.status === "DONE");

  const byActivity = (a: Thread, b: Thread) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();

  return [
    ...urgentOpen.sort(byActivity),
    ...open.sort(byActivity),
    ...done.sort(byActivity),
  ];
}

export function ThreadList({ groupId }: { groupId: string }) {
  const pathname = usePathname();
  const [showNewThread, setShowNewThread] = useState(false);
  const utils = trpc.useUtils();

  const { data: rawThreads = [], isLoading } = trpc.threads.list.useQuery(
    { groupId },
    { refetchOnWindowFocus: false }
  );

  // Cast the data
  const threads = rawThreads as unknown as Thread[];
  const sorted = sortThreads(threads);

  // Realtime: subscribe to thread updates in this group
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`threads:group:${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "threads",
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          utils.threads.list.invalidate({ groupId });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, utils]);

  return (
    <div className="w-80 flex-shrink-0 border-r border-border flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h2 className="font-mono text-sm font-semibold text-ink">Threads</h2>
        <button
          onClick={() => setShowNewThread(true)}
          className="font-mono text-xs text-muted hover:text-ink transition-colors px-2 py-1 border border-border hover:border-ink"
        >
          + New
        </button>
      </div>

      {/* Thread items */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[72px] bg-border/40 animate-pulse"
              />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-muted">No threads yet</p>
            <button
              onClick={() => setShowNewThread(true)}
              className="mt-2 font-mono text-xs text-accent hover:underline"
            >
              Create the first one
            </button>
          </div>
        ) : (
          <ul>
            {sorted.map((thread) => {
              const href = `/g/${groupId}/t/${thread.id}`;
              const isActive = pathname === href;
              const lastMessage = thread.messages?.[thread.messages.length - 1];

              return (
                <li
                  key={thread.id}
                  className={`border-b border-border ${
                    thread.status === "DONE" ? "opacity-40" : ""
                  }`}
                >
                  <Link
                    href={href}
                    className={`block px-4 py-3 transition-colors min-h-[72px] ${
                      isActive
                        ? "bg-ink/5"
                        : "hover:bg-border/30"
                    } ${
                      thread.status === "URGENT"
                        ? "border-l-[3px] border-l-accent pl-[13px]"
                        : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span
                        className={`font-mono text-sm font-medium text-ink leading-tight line-clamp-1 ${
                          isActive ? "font-semibold" : ""
                        }`}
                      >
                        {thread.title}
                      </span>
                      <span className="text-[10px] text-muted flex-shrink-0 mt-0.5 font-mono">
                        {formatRelative(thread.updated_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={thread.status} />
                      {lastMessage && (
                        <span className="text-xs text-muted truncate">
                          {lastMessage.body}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {showNewThread && (
        <NewThreadDialog
          groupId={groupId}
          onClose={() => setShowNewThread(false)}
        />
      )}
    </div>
  );
}
