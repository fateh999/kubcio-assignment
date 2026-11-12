"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-renders the board's server component on an interval so staff see other people's changes
 * (check-ins, patients taken, sent on) without reloading. router.refresh() keeps client state.
 * Pauses while the tab is hidden, and refreshes at once when it becomes visible again.
 */
export function AutoRefresh({ intervalMs }: { intervalMs: number }) {
  const router = useRouter();

  useEffect(() => {
    const visible = () => document.visibilityState === "visible";
    const id = window.setInterval(() => {
      if (visible()) router.refresh();
    }, intervalMs);
    const onVisibility = () => {
      if (visible()) router.refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, intervalMs]);

  return null;
}
