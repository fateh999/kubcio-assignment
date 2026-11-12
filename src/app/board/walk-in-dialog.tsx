"use client";

import { useState } from "react";
import { addWalkIn } from "@/actions/visits";
import { ActionMessage, useAction } from "@/components/use-action";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SEX_ITEMS = [
  { value: "F", label: "Female" },
  { value: "M", label: "Male" },
  { value: "X", label: "Not stated" },
];

const EMPTY = { name: "", dob: "", sex: null as string | null, phone: "", email: "", reason: "", urgent: false };

/** Reception adds a patient who arrives without an appointment; they go straight to "Checked in". */
export function WalkInDialog() {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY);
  const { run, pending, result, clear } = useAction();
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) clear();
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>Add walk-in</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => addWalkIn({ ...f, sex: (f.sex ?? "") as "F" | "M" | "X" }),
              () => {
                setOpen(false);
                setF(EMPTY);
                clear();
              },
            );
          }}
        >
          <DialogHeader>
            <DialogTitle>Add walk-in</DialogTitle>
            <DialogDescription>For a patient without an appointment. They&apos;re checked in now and join the nurse&apos;s queue.</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="wi-name">Full name</FieldLabel>
            <Input id="wi-name" required value={f.name} onChange={set("name")} />
          </Field>
          <Field>
            <FieldLabel htmlFor="wi-reason">Reason for visit</FieldLabel>
            <Input id="wi-reason" required value={f.reason} onChange={set("reason")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="wi-dob">Date of birth (optional)</FieldLabel>
              <Input id="wi-dob" type="date" value={f.dob} onChange={set("dob")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="wi-sex">Sex</FieldLabel>
              <Select items={SEX_ITEMS} value={f.sex} onValueChange={(v) => setF({ ...f, sex: v as string | null })}>
                <SelectTrigger id="wi-sex" aria-label="Sex" className="w-full">
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  {SEX_ITEMS.map((i) => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="wi-phone">Phone</FieldLabel>
              <Input id="wi-phone" required value={f.phone} onChange={set("phone")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="wi-email">Email (optional)</FieldLabel>
              <Input id="wi-email" type="email" value={f.email} onChange={set("email")} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={f.urgent} onCheckedChange={(c) => setF({ ...f, urgent: c === true })} aria-label="Urgent" />
            Urgent
          </label>
          <ActionMessage result={result && "error" in result ? result : null} />
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add and check in"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
