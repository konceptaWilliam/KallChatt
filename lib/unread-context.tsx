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
  // groupId -> urgent unread count
  groupUrgentCounts: Record<string, number>;
  setThreadCount: (threadId: string, groupId: string, count: number, isUrgent?: boolean) => void;
  markRead: (threadId: string, groupId: string) => void;
};

const UnreadContext = createContext<UnreadContextType>({
  threadCounts: {},
  groupCounts: {},
  groupUrgentCounts: {},
  setThreadCount: () => {},
  markRead: () => {},
});

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const [threadCounts, setThreadCounts] = useState<Record<string, number>>({});
  const [threadIsUrgent, setThreadIsUrgent] = useState<Record<string, boolean>>({});
  const [groupCounts, setGroupCounts] = useState<Record<string, number>>({});
  const [groupUrgentCounts, setGroupUrgentCounts] = useState<Record<string, number>>({});

  const setThreadCount = useCallback(
    (threadId: string, groupId: string, count: number, isUrgent = false) => {
      const oldCount = threadCounts[threadId] ?? 0;
      const wasUrgent = threadIsUrgent[threadId] ?? false;

      setThreadCounts((prev) => {
        if (prev[threadId] === count) return prev;
        return { ...prev, [threadId]: count };
      });
      setThreadIsUrgent((prev) => {
        if (prev[threadId] === isUrgent) return prev;
        return { ...prev, [threadId]: isUrgent };
      });
      setGroupCounts((prev) => {
        const delta = count - oldCount;
        if (delta === 0) return prev;
        return { ...prev, [groupId]: Math.max(0, (prev[groupId] ?? 0) + delta) };
      });
      setGroupUrgentCounts((prev) => {
        const oldUrgent = wasUrgent ? oldCount : 0;
        const newUrgent = isUrgent ? count : 0;
        const delta = newUrgent - oldUrgent;
        if (delta === 0) return prev;
        return { ...prev, [groupId]: Math.max(0, (prev[groupId] ?? 0) + delta) };
      });
    },
    [threadCounts, threadIsUrgent]
  );

  const markRead = useCallback((threadId: string, groupId: string) => {
    setLastSeen(threadId, Date.now());
    const threadCount = threadCounts[threadId] ?? 0;
    const wasUrgent = threadIsUrgent[threadId] ?? false;
    setThreadCounts((prev) => {
      if (!prev[threadId]) return prev;
      return { ...prev, [threadId]: 0 };
    });
    setGroupCounts((prev) => {
      return { ...prev, [groupId]: Math.max(0, (prev[groupId] ?? 0) - threadCount) };
    });
    if (wasUrgent && threadCount > 0) {
      setGroupUrgentCounts((prev) => {
        return { ...prev, [groupId]: Math.max(0, (prev[groupId] ?? 0) - threadCount) };
      });
    }
  }, [threadCounts, threadIsUrgent]);

  return (
    <UnreadContext.Provider value={{ threadCounts, groupCounts, groupUrgentCounts, setThreadCount, markRead }}>
      {children}
    </UnreadContext.Provider>
  );
}

export function useUnread() {
  return useContext(UnreadContext);
}
