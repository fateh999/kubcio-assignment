"use client";

import { useState, useTransition } from "react";
import { addStaff, changeRole, deactivateStaff, reactivateStaff, type ActionResult } from "@/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Role } from "@/lib/roles";
import { TableCard } from "@/components/ui-kit";

type StaffRow = { id: string; name: string; email: string; role: Role | null; active: boolean };

const ROLE_ITEMS: { value: Role; label: string }[] = [
  { value: "doctor", label: "Doctor" },
  { value: "nurse", label: "Nurse" },
  { value: "receptionist", label: "Receptionist" },
  { value: "admin", label: "Admin" },
];

function RoleSelect({
  value,
  onChange,
  disabled,
  label,
  id,
}: {
  value: Role | null;
  onChange: (role: Role) => void;
  disabled?: boolean;
  label: string;
  id?: string;
}) {
  return (
    <Select items={ROLE_ITEMS} value={value} onValueChange={(v) => v && onChange(v as Role)} disabled={disabled}>
      <SelectTrigger id={id} aria-label={label} className="w-40">
        <SelectValue placeholder="Choose a role" />
      </SelectTrigger>
      <SelectContent>
        {ROLE_ITEMS.map((r) => (
          <SelectItem key={r.value} value={r.value}>
            {r.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AddStaffDialog({ onResult }: { onResult: (r: ActionResult) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!role) return setError("Choose a role");
    startTransition(async () => {
      const result = await addStaff({ name, email, role });
      if ("error" in result) return setError(result.error);
      setOpen(false);
      setName("");
      setEmail("");
      setRole(null);
      setError(null);
      onResult(result);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Add staff</DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Add staff</DialogTitle>
            <DialogDescription>They&apos;ll get a sign-in link by email (Mailpit).</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="staff-name">Name</FieldLabel>
            <Input id="staff-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="staff-email">Email</FieldLabel>
            <Input id="staff-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="staff-role">Role</FieldLabel>
            <RoleSelect id="staff-role" label="Role" value={role} onChange={setRole} />
          </Field>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add and send invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function StaffTable({ staff, currentUserId }: { staff: StaffRow[]; currentUserId: string }) {
  const [message, setMessage] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<ActionResult>) =>
    startTransition(async () => {
      setMessage(await action());
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div aria-live="polite" className="min-h-5 text-sm">
          {message && "ok" in message && <span className="text-emerald-700 dark:text-emerald-400">{message.ok}</span>}
          {message && "error" in message && (
            <span role="alert" className="text-destructive">
              {message.error}
            </span>
          )}
        </div>
        <AddStaffDialog onResult={setMessage} />
      </div>

      <TableCard>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="hidden md:table-cell">Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {staff.map((s) => {
            const isMe = s.id === currentUserId;
            return (
              <TableRow key={s.id} data-testid={`staff-${s.email}`}>
                <TableCell className="font-medium">
                  {s.name}
                  {isMe && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                  <span className="block text-xs font-normal text-muted-foreground md:hidden">{s.email}</span>
                </TableCell>
                <TableCell className="hidden md:table-cell">{s.email}</TableCell>
                <TableCell>
                  <RoleSelect
                    label={`Role for ${s.name}`}
                    value={s.role}
                    disabled={isMe || pending}
                    onChange={(role) => run(() => changeRole(s.id, role))}
                  />
                </TableCell>
                <TableCell>
                  {s.active ? <Badge variant="secondary">Active</Badge> : <Badge variant="destructive">Deactivated</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  {isMe ? (
                    <span className="text-xs text-muted-foreground">Can&apos;t deactivate yourself</span>
                  ) : s.active ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => run(() => deactivateStaff(s.id))}
                    >
                      Deactivate {s.name}
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => reactivateStaff(s.id))}>
                      Reactivate {s.name}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </TableCard>
    </div>
  );
}
