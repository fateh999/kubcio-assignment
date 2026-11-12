import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/require-user";
import { STAGE_LABEL } from "@/lib/visit-stages";
import { getCheckoutVisit } from "@/server/queries";
import { CheckoutPanel } from "./checkout-panel";

// Per-user, session-gated page: render on the server before sending (no instant shell).
export const instant = false;

// Checkout (FR5 · SPEC §10.5). No clinical data on this page.
export default async function CheckoutPage({ params }: PageProps<"/visits/[id]/checkout">) {
  const me = await requireUser(["receptionist", "doctor"]);
  const { id } = await params;
  const data = await getCheckoutVisit(id);
  if (!data) notFound();
  const { visit: v, tasks } = data;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
      <Link href="/board" className="text-sm underline underline-offset-4">
        ← Visit board
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold">Checkout · {v.patientName}</h1>
        <Badge variant="secondary">{STAGE_LABEL[v.stage]}</Badge>
      </div>
      <CheckoutPanel
        role={me.role}
        visit={{ id: v.id, stage: v.stage, patientId: v.patientId, phone: v.phone, email: v.email }}
        tasks={tasks}
      />
    </main>
  );
}
