"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";

// Login "catch-up" opener: a slim, dismissible bar surfacing what awaits the
// user across all groups (unread URGENT threads + total unread). Completion-loop
// hook — shown at most once per calendar day so it opens the session without
// nagging. Mirrors NotificationNudge's fixed-bar + localStorage-gate pattern.

const SHOWN_KEY = "catchUp:lastShownDay";

// Local calendar day (not UTC) so "once per day" matches the user's midnight.
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function CatchUpBanner() {
  const router = useRouter();
  const { data } = trpc.threads.catchUp.useQuery(undefined, {
    // Fresh enough for an opener; avoids refetch churn as the user navigates.
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const [visible, setVisible] = useState(false);
  const decidedRef = useRef(false);

  useEffect(() => {
    if (decidedRef.current || !data) return;
    const { urgentTotal, unreadTotal } = data;
    if (urgentTotal === 0 && unreadTotal === 0) return;

    try {
      if (localStorage.getItem(SHOWN_KEY) === todayKey()) return;
      // Consume the day's slot up front so navigating away doesn't re-show it.
      localStorage.setItem(SHOWN_KEY, todayKey());
    } catch {
      // localStorage unavailable — still show once for this mount.
    }
    decidedRef.current = true;
    setVisible(true);
  }, [data]);

  if (!visible || !data) return null;

  const { urgentTotal, unreadTotal, urgentThreads } = data;
  const firstUrgent = urgentThreads[0];

  const open = () => {
    setVisible(false);
    if (firstUrgent) {
      router.push(`/g/${firstUrgent.group_id}/t/${firstUrgent.id}`);
    }
  };

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-surface-2 px-safe"
      role="dialog"
      aria-label="Catch up"
    >
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-2.5">
        {firstUrgent ? (
          <button
            onClick={open}
            className="flex flex-1 items-center gap-2 text-left"
          >
            <CatchUpText urgentTotal={urgentTotal} unreadTotal={unreadTotal} />
            <span className="font-mono text-xs text-muted" aria-hidden>
              →
            </span>
          </button>
        ) : (
          <div className="flex-1">
            <CatchUpText urgentTotal={urgentTotal} unreadTotal={unreadTotal} />
          </div>
        )}
        <button
          onClick={() => setVisible(false)}
          aria-label="Dismiss"
          className="px-2 py-1 font-mono text-xs text-muted hover:text-ink"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function CatchUpText({
  urgentTotal,
  unreadTotal,
}: {
  urgentTotal: number;
  unreadTotal: number;
}) {
  return (
    <span className="font-mono text-xs text-ink">
      {urgentTotal > 0 && (
        <span className="font-semibold text-urgent-ink">
          {urgentTotal} URGENT
        </span>
      )}
      {urgentTotal > 0 && unreadTotal > 0 && (
        <span className="text-muted-2"> · </span>
      )}
      {unreadTotal > 0 && (
        <span className="text-muted">
          {unreadTotal} unread thread{unreadTotal === 1 ? "" : "s"}
        </span>
      )}
      <span className="text-muted"> waiting</span>
    </span>
  );
}
