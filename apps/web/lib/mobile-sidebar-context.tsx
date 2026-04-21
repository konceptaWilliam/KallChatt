"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type MobileSidebarCtx = { isOpen: boolean; open: () => void; close: () => void };

const MobileSidebarContext = createContext<MobileSidebarCtx>({
  isOpen: false,
  open: () => {},
  close: () => {},
});

export function MobileSidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  return (
    <MobileSidebarContext.Provider value={{ isOpen, open, close }}>
      {children}
    </MobileSidebarContext.Provider>
  );
}

export function useMobileSidebar() {
  return useContext(MobileSidebarContext);
}
