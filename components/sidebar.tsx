"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Group = { id: string; name: string };

export function Sidebar({
  groups,
  userDisplayName,
  userEmail,
  isAdmin,
}: {
  groups: Group[];
  userDisplayName: string;
  userEmail: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <aside className="w-60 flex-shrink-0 border-r border-border flex flex-col h-full bg-surface">
      {/* Workspace wordmark */}
      <div className="px-4 py-4 border-b border-border">
        <span className="font-mono text-base font-semibold text-ink tracking-tight">
          kallchatt
        </span>
      </div>

      {/* Group list */}
      <nav className="flex-1 overflow-y-auto py-2">
        <div className="px-4 pt-1 pb-2">
          <span className="font-mono text-[10px] font-medium text-muted uppercase tracking-widest">
            Groups
          </span>
        </div>
        {groups.length === 0 ? (
          <p className="px-4 text-xs text-muted">No groups yet</p>
        ) : (
          <ul>
            {groups.map((group) => {
              const href = `/g/${group.id}`;
              const isActive = pathname.startsWith(href);
              return (
                <li key={group.id}>
                  <Link
                    href={href}
                    className={`block px-4 py-2 font-mono text-sm transition-colors ${
                      isActive
                        ? "bg-ink text-surface"
                        : "text-ink hover:bg-border/50"
                    }`}
                  >
                    . {group.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      {/* Bottom user area */}
      <div className="border-t border-border p-3">
        <Link
          href="/settings"
          className={`block px-2 py-1.5 font-mono text-xs text-muted hover:text-ink transition-colors mb-1 ${
            pathname === "/settings" ? "text-ink" : ""
          }`}
        >
          Settings
        </Link>
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink truncate">
              {userDisplayName}
            </p>
            <p className="text-xs text-muted truncate">{userEmail}</p>
          </div>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="ml-2 font-mono text-xs text-muted hover:text-ink transition-colors flex-shrink-0"
          >
            {signingOut ? "..." : "out"}
          </button>
        </div>
      </div>
    </aside>
  );
}
