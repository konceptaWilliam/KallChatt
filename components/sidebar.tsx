"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SearchDialog } from "./search-dialog";
import { useUnread } from "@/lib/unread-context";
import { useMobileSidebar } from "@/lib/mobile-sidebar-context";

type Group = { id: string; name: string };

export function Sidebar({
  groups,
  userDisplayName,
  avatarUrl,
}: {
  groups: Group[];
  userDisplayName: string;
  avatarUrl: string | null;
}) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const { groupCounts, groupUrgentCounts } = useUnread();
  const { isOpen, close } = useMobileSidebar();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const initials = userDisplayName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 z-30 bg-black/40 md:hidden transition-opacity duration-200 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={close}
        aria-hidden="true"
      />

      <aside
        className={`
          w-[232px] flex-shrink-0 border-r border-border flex flex-col bg-surface
          fixed inset-y-0 left-0 z-40
          transition-transform duration-200 ease-in-out
          md:relative md:z-auto md:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo */}
        <div className="px-[18px] py-[18px] flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 inline-block border border-pastel-deep flex-shrink-0"
            style={{
              background: "var(--pastel)",
              transform: "rotate(45deg)",
            }}
          />
          <span className="font-mono text-sm font-semibold text-ink tracking-[-0.01em]">
            coldsoup
          </span>
        </div>

        {/* Search */}
        <button
          onClick={() => setSearchOpen(true)}
          className="mx-3 mb-3 flex items-center gap-2 px-2.5 py-1.5 border border-border text-muted hover:text-ink hover:border-border-strong transition-colors w-[calc(100%-24px)]"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span className="font-mono text-[11px] flex-1 text-left">search</span>
        </button>

        {/* Group list */}
        <div className="px-[18px] pb-2">
          <span className="font-mono text-[10px] text-muted-2 uppercase tracking-[0.18em]">
            Groups
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto px-2">
          {groups.length === 0 ? (
            <p className="px-3 text-xs text-muted">No groups yet</p>
          ) : (
            groups.map((group) => {
              const href = `/g/${group.id}`;
              const isActive = pathname.startsWith(href);
              return (
                <Link
                  key={group.id}
                  href={href}
                  onClick={close}
                  className={`flex items-center justify-between w-full px-2.5 py-[11px] md:py-[7px] my-px font-mono text-[13px] transition-all duration-150 ${
                    isActive
                      ? "bg-pastel-tint text-pastel-ink border border-pastel-deep font-semibold"
                      : "text-ink border border-transparent hover:bg-border/50"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className={isActive ? "text-pastel-deep" : "text-muted-2"}>·</span>
                    {group.name}
                  </span>
                  {(groupCounts[group.id] ?? 0) > 0 && (
                    <span
                      className="inline-block w-2 h-2 flex-shrink-0"
                      style={{
                        background: (groupUrgentCounts[group.id] ?? 0) > 0 ? "hsl(0 75% 52%)" : "hsl(0 70% 78%)",
                        border: `1px solid ${(groupUrgentCounts[group.id] ?? 0) > 0 ? "hsl(0 65% 38%)" : "hsl(0 50% 62%)"}`,
                        transform: "rotate(45deg)",
                      }}
                    />
                  )}
                </Link>
              );
            })
          )}
        </nav>

        {/* Bottom user area */}
        <div className="border-t border-border p-3">
          <Link
            href="/settings"
            onClick={close}
            className={`block px-2 py-1.5 font-mono text-xs mb-2 transition-colors ${
              pathname === "/settings" ? "text-ink" : "text-muted hover:text-ink"
            }`}
          >
            settings
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 flex-shrink-0 border border-border overflow-hidden flex items-center justify-center font-mono text-[10px] font-semibold"
              style={{ background: "hsl(180 30% 92%)", color: "hsl(180 40% 28%)" }}
            >
              {avatarUrl && !avatarError ? (
                <img
                  src={avatarUrl}
                  alt={userDisplayName}
                  className="w-full h-full object-cover"
                  onError={() => setAvatarError(true)}
                />
              ) : initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-ink truncate leading-tight">{userDisplayName}</p>
              <p className="font-mono text-[10px] text-muted leading-tight flex items-center gap-1">
                online
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: "var(--pastel-deep)", animation: "pulseDot 2s ease-in-out infinite" }}
                />
              </p>
            </div>
          </div>
        </div>
      </aside>

      {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} />}
    </>
  );
}
