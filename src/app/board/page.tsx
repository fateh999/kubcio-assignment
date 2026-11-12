import Link from "next/link";
import { PageHeader, StageBadge, TableCard, UrgentBadge } from "@/components/ui-kit";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatTime, formatTimeWithSeconds, minutesSince, shortName } from "@/lib/format";
import { requireUser } from "@/lib/require-user";
import type { Role } from "@/lib/roles";
import { STAGE_LABEL, VISIT_STAGES, isWaiting, type VisitStage } from "@/lib/visit-stages";
import { cn } from "@/lib/utils";
import { type BoardRow, getBoard } from "@/server/queries";
import { AutoRefresh } from "./auto-refresh";
import { BoardRowActions } from "./row-actions";
import { WalkInDialog } from "./walk-in-dialog";

// Per-user, session-gated page: render on the server before sending (no instant shell).
export const instant = false;

/** How often the board re-fetches (polling for now; enough for one small clinic). Kept here, not in the
 * "use client" file: a server component can't read plain values exported from a client module. */
const BOARD_POLL_MS = 10_000;

/** Tabs (SPEC §10.1). "mine" is each role's own queue. */
const MY_QUEUE: Record<Role, VisitStage[] | null> = {
  receptionist: ["scheduled", "checked_in", "ready_for_checkout"],
  nurse: ["checked_in"],
  doctor: ["ready_for_doctor"],
  admin: null,
};
const MY_QUEUE_LABEL: Record<Role, string> = {
  receptionist: "My queue",
  nurse: "Waiting for nurse",
  doctor: "Waiting for doctor",
  admin: "",
};

function handledBy(v: BoardRow): string {
  switch (v.stage) {
    case "with_nurse":
      return `With nurse · ${shortName(v.nurseName)}`;
    case "with_doctor":
      return `With doctor · ${shortName(v.doctorName)}`;
    case "ready_for_doctor":
      return v.nurseName ? `Seen by ${shortName(v.nurseName)}` : "";
    case "ready_for_checkout":
    case "done":
      return v.doctorName ? `Seen by ${shortName(v.doctorName)}` : "";
    default:
      return "";
  }
}

export default async function BoardPage({ searchParams }: PageProps<"/board">) {
  const user = await requireUser(["admin", "receptionist", "nurse", "doctor"]);
  const { tab: tabParam } = await searchParams;
  const now = new Date();
  const rows = await getBoard(now);

  const myQueue = MY_QUEUE[user.role];
  const tab = typeof tabParam === "string" ? tabParam : myQueue ? "mine" : "all";
  const shown = rows.filter((r) => {
    if (tab === "all") return true;
    if (tab === "mine") return myQueue ? myQueue.includes(r.stage) : true;
    return r.stage === tab;
  });

  const tabs = [
    ...(myQueue ? [{ key: "mine", label: MY_QUEUE_LABEL[user.role], n: rows.filter((r) => myQueue.includes(r.stage)).length }] : []),
    { key: "all", label: "All", n: rows.length },
    ...VISIT_STAGES.map((s) => ({ key: s, label: STAGE_LABEL[s], n: rows.filter((r) => r.stage === s).length })),
  ];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8">
      <PageHeader
        title="Visit board"
        description={`Today · ${rows.length} ${rows.length === 1 ? "visit" : "visits"} · urgent first, then by arrival`}
        actions={
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <AutoRefresh intervalMs={BOARD_POLL_MS} />
            <span className="inline-flex items-center gap-1.5" data-testid="board-updated" title={`Refreshes every ${BOARD_POLL_MS / 1000} seconds while this tab is open`}>
              <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
              Updated {formatTimeWithSeconds(now)} · every {BOARD_POLL_MS / 1000}s
            </span>
            <Link href={`/board?tab=${tab}`} className="font-medium text-foreground hover:underline" prefetch={false}>
              Refresh now
            </Link>
            {user.role === "receptionist" && <WalkInDialog />}
          </div>
        }
      />

      <nav aria-label="Filter by stage" className="no-scrollbar mb-4 flex gap-1 overflow-x-auto rounded-xl border bg-card p-1 text-sm whitespace-nowrap shadow-xs md:flex-wrap">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/board?tab=${t.key}`}
            aria-current={t.key === tab ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors",
              t.key === tab ? "bg-primary font-medium text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t.label}
            <span className={cn("rounded-full px-1.5 text-xs tabular-nums", t.key === tab ? "bg-primary-foreground/20" : "bg-muted")}>{t.n}</span>
          </Link>
        ))}
      </nav>

      {/* Phone/tablet: one card per visit. */}
      <ul className="flex flex-col gap-3 md:hidden" aria-label="Visits">
        {shown.length === 0 && <li className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">No patients here right now.</li>}
        {shown.map((v) => {
          const waited = v.arrivedAt && isWaiting(v.stage) ? minutesSince(v.arrivedAt, now) : null;
          return (
            <li
              key={v.id}
              data-testid={`visit-card-${v.patientName}`}
              className={cn("rounded-xl border bg-card p-4 shadow-xs", v.urgent && v.stage !== "done" && "border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {v.patientName}
                    {v.urgent && <UrgentBadge />}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{v.reason}</p>
                </div>
                <StageBadge stage={v.stage} />
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums text-muted-foreground">
                <span>Appt {formatTime(v.appointmentAt)}</span>
                <span>{v.arrivedAt ? `Arrived ${formatTime(v.arrivedAt)}` : "Not arrived"}</span>
                {waited !== null && <span className={cn(waited >= 30 && "font-medium text-amber-700 dark:text-amber-400")}>Waiting {waited} min</span>}
              </div>
              {(handledBy(v) || v.preferredDoctorName) && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {[handledBy(v), v.preferredDoctorName && `Prefers ${v.preferredDoctorName}`].filter(Boolean).join(" · ")}
                </p>
              )}
              <div className="mt-3 flex justify-start [&>div]:items-start">
                <BoardRowActions
                  role={user.role}
                  visit={{ id: v.id, stage: v.stage, urgent: v.urgent, mine: v.nurseId === user.id || v.doctorId === user.id }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {/* Desktop: table. */}
      <TableCard className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Appt · arrived</TableHead>
              <TableHead>Waiting</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Handled by</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                  No patients here right now.
                </TableCell>
              </TableRow>
            )}
            {shown.map((v) => {
              const waited = v.arrivedAt && isWaiting(v.stage) ? minutesSince(v.arrivedAt, now) : null;
              return (
                <TableRow key={v.id} data-testid={`visit-${v.patientName}`} className={cn(v.urgent && v.stage !== "done" && "bg-red-50/60 dark:bg-red-950/20")}>
                  <TableCell>
                    <div className="flex items-center gap-2 font-medium whitespace-nowrap">
                      {v.patientName}
                      {v.urgent && <UrgentBadge />}
                    </div>
                    {v.preferredDoctorName && (
                      <p className="text-xs text-muted-foreground" data-testid="preferred-doctor">
                        Prefers {v.preferredDoctorName}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="max-w-64 truncate text-muted-foreground" title={v.reason}>
                    {v.reason}
                  </TableCell>
                  <TableCell className="tabular-nums whitespace-nowrap">
                    {formatTime(v.appointmentAt)}
                    <span className="text-muted-foreground"> · {v.arrivedAt ? formatTime(v.arrivedAt) : "not arrived"}</span>
                  </TableCell>
                  <TableCell className={cn("tabular-nums", waited !== null && waited >= 30 && "font-medium text-amber-700 dark:text-amber-400")}>
                    {waited !== null ? `${waited} min` : ""}
                  </TableCell>
                  <TableCell>
                    <StageBadge stage={v.stage} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{handledBy(v)}</TableCell>
                  <TableCell className="text-right">
                    <BoardRowActions
                      role={user.role}
                      visit={{ id: v.id, stage: v.stage, urgent: v.urgent, mine: v.nurseId === user.id || v.doctorId === user.id }}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableCard>
    </main>
  );
}
