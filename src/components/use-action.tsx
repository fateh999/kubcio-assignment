"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/server/common";

/**
 * Runs a server action, keeps its result message, and refreshes the page on success.
 * `then` can navigate instead (e.g. to the nurse page after "Take patient").
 */
export function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  function run(action: () => Promise<ActionResult>, then?: (r: ActionResult) => void) {
    startTransition(async () => {
      const r = await action();
      setResult(r);
      if ("ok" in r) {
        if (then) then(r);
        else router.refresh();
      } else {
        // The page may be stale (e.g. someone else moved the patient): show the latest state.
        router.refresh();
      }
    });
  }

  return { run, pending, result, clear: () => setResult(null) };
}

export function ActionMessage({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  if ("error" in result)
    return (
      <p role="alert" className="text-sm text-destructive">
        {result.error}
      </p>
    );
  return (
    <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
      {result.ok}
    </p>
  );
}
