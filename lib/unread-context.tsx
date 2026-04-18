"use client";

import { createContext, useContext, useState, useCallback } from "react";

const LS_PREFIX = "coldsoup:lastSeen:";

export function getLastSeen(threadId: string): number {
  try {
    return parseInt(localStorage.getItem(LS_PREFIX + threadId) ?? "0", 10);
  } catch {
    return 0;
  }
}

export function setLastSeen(threadId: string, ts: number) {
  try {
    localStorage.setItem(LS_PREFIX + threadId, String(ts));
  } catch {}
}

type UnreadContextType = {
  // threadId -> unread count
  threadCounts: Record<string, number>;
  // groupId -> total unread count
  groupCounts: Record<string, number>;
  setThreadCount: (threadId: string, groupId: string, count: number) => void;
  markRead: (threadId: string, groupId: string) => void;
};

const UnreadContext = createContext<UnreadContextType>({
  threadCounts: {},
  groupCounts: {},
  setThreadCount: () => {},
  markRead: () => {},
});

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const [threadCounts, setThreadCounts] = useState<Record<string, number>>({});
  const [groupCounts, setGroupCounts] = useState<Record<string, number>>({});

  const setThreadCount = useCallback(
    (threadId: string, groupId: string, count: number) => {
      setThreadCounts((prev) => {
        if (prev[threadId] === count) return prev;
        return { ...prev, [threadId]: count };
      });
      setGroupCounts((prev) => {
        // Recalculate group total: replace old thread count with new
        const old = threadCounts[threadId] ?? 0;
        const delta = count - old;
        if (delta === 0) return prev;
        const next = Math.max(0, (prev[groupId] ?? 0) + delta);
        return { ...prev, [groupId]: next };
      });
    },
    [threadCounts]
  );

  const markRead = useCallback((threadId: string, groupId: string) => {
    setLastSeen(threadId, Date.now());
    setThreadCounts((prev) => {
      if (!prev[threadId]) return prev;
      return { ...prev, [threadId]: 0 };
    });
    setGroupCounts((prev) => {
      const old = prev[groupId] ?? 0;
      const threadCount = threadCounts[threadId] ?? 0;
      const next = Math.max(0, old - threadCount);
      return { ...prev, [groupId]: next };
    });
  }, [threadCounts]);

  return (
    <UnreadContext.Provider value={{ threadCounts, groupCounts, setThreadCount, markRead }}>
      {children}
    </UnreadContext.Provider>
  );
}

export function useUnread() {
  return useContext(UnreadContext);
}
