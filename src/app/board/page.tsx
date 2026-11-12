import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatTime, formatTimeWithSeconds, minutesSince, shortName } from "@/lib/format";
import { requireUser } from "@/lib/require-user";
import type { Role } from "@/lib/roles";
import { STAGE_LABEL, VISIT_STAGES, isWaiting, type VisitStage } from "@/lib/visit-stages";
import { type BoardRow, getBoard } from "@/server/queries";
import { AutoRefresh } from "./auto-refresh";
import { BoardRowActions } from "./row-actions";

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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Visit board · today</h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <AutoRefresh intervalMs={BOARD_POLL_MS} />
          <span data-testid="board-updated" title={`Refreshes every ${BOARD_POLL_MS / 1000} seconds while this tab is open`}>
            Updated {formatTimeWithSeconds(now)} · every {BOARD_POLL_MS / 1000}s
          </span>
          <Link href={`/board?tab=${tab}`} className="text-foreground underline underline-offset-4" prefetch={false}>
            Refresh now
          </Link>
        </div>
      </div>

      <nav aria-label="Filter by stage" className="mb-4 flex flex-wrap gap-1 rounded-lg bg-muted p-1 text-sm">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/board?tab=${t.key}`}
            aria-current={t.key === tab ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 ${t.key === tab ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t.label} <span className="text-xs text-muted-foreground">({t.n})</span>
          </Link>
        ))}
      </nav>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Patient</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Preferred doctor</TableHead>
            <TableHead>Appt</TableHead>
            <TableHead>Arrived</TableHead>
            <TableHead>Waiting</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Handled by</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                No patients here right now.
              </TableCell>
            </TableRow>
          )}
          {shown.map((v) => (
            <TableRow key={v.id} data-testid={`visit-${v.patientName}`}>
              <TableCell className="font-medium">
                {v.patientName}
                {v.urgent && (
                  <Badge variant="destructive" className="ml-2">
                    Urgent
                  </Badge>
                )}
              </TableCell>
              <TableCell className="max-w-56 truncate" title={v.reason}>
                {v.reason}
              </TableCell>
              <TableCell>{v.preferredDoctorName ?? "—"}</TableCell>
              <TableCell>{formatTime(v.appointmentAt)}</TableCell>
              <TableCell>{formatTime(v.arrivedAt)}</TableCell>
              <TableCell>{v.arrivedAt && isWaiting(v.stage) ? `${minutesSince(v.arrivedAt, now)} min` : ""}</TableCell>
              <TableCell>
                <Badge variant={v.stage === "done" ? "outline" : "secondary"}>{STAGE_LABEL[v.stage]}</Badge>
              </TableCell>
              <TableCell>{handledBy(v)}</TableCell>
              <TableCell className="text-right">
                <BoardRowActions
                  role={user.role}
                  visit={{ id: v.id, stage: v.stage, urgent: v.urgent, mine: v.nurseId === user.id || v.doctorId === user.id }}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </main>
  );
}
