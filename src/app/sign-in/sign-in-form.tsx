"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

// Same message whatever the email, so the page doesn't reveal who is on staff (SPEC §5.2 step 2).
const SENT_MESSAGE =
  "If this email belongs to clinic staff, a sign-in link has been sent. Check Mailpit at localhost:8025.";
// Rate limiting applies to every email alike, so saying so reveals nothing about who is on staff.
const LIMITED_MESSAGE = "Too many sign-in attempts from this network. Wait a minute and try again.";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<"idle" | "sent" | "limited">("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    // Success and "not a staff email" look the same on purpose. Only rate limiting is reported.
    const result = await authClient.signIn
      .magicLink({ email: email.trim(), callbackURL: "/", errorCallbackURL: "/sign-in" })
      .catch(() => null);
    setPending(false);
    setStatus(result?.error?.status === 429 ? "limited" : "sent");
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="email">Email</FieldLabel>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setStatus("idle");
          }}
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Email me a sign-in link"}
      </Button>
      {status === "sent" && (
        <p role="status" className="text-sm text-muted-foreground">
          {SENT_MESSAGE}
        </p>
      )}
      {status === "limited" && (
        <p role="alert" className="text-sm text-destructive">
          {LIMITED_MESSAGE}
        </p>
      )}
    </form>
  );
}
