/** Small shared layout pieces so every screen looks the same. Server-safe (no client hooks). */
import { cn } from "@/lib/utils";
import { STAGE_LABEL, type VisitStage } from "@/lib/visit-stages";

export function PageHeader({
  title,
  description,
  actions,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

/** A table in a bordered card with a muted header row. */
export function TableCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-xs",
        "[&_thead_tr]:bg-muted/50 [&_th]:h-10 [&_th]:px-4 [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground",
        "[&_td]:px-4 [&_td]:py-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Small uppercase label above a value. */
export function FieldCaption({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{children}</p>;
}

const STAGE_STYLE: Record<VisitStage, string> = {
  scheduled: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  checked_in: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  with_nurse: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  ready_for_doctor: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  with_doctor: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
  ready_for_checkout: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  done: "bg-transparent text-muted-foreground ring-1 ring-inset ring-border",
};

export function StageBadge({ stage }: { stage: VisitStage }) {
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap", STAGE_STYLE[stage])}>
      {STAGE_LABEL[stage]}
    </span>
  );
}

export function UrgentBadge() {
  return (
    <span className="inline-flex h-5 items-center gap-1 rounded-full bg-red-100 px-2 text-[11px] font-semibold uppercase tracking-wide text-red-700 dark:bg-red-950 dark:text-red-300">
      <span className="size-1.5 rounded-full bg-red-500" aria-hidden />
      Urgent
    </span>
  );
}
