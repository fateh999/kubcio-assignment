"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

// Same message whatever the email, so the page doesn't reveal who is on staff (SPEC §5.2 step 2).
const SENT_MESSAGE =
  "If this email belongs to clinic staff, a sign-in link has been sent. Check Mailpit at localhost:8025.";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    // The result is ignored on purpose: success and failure show the same message.
    await authClient.signIn.magicLink({ email: email.trim(), callbackURL: "/", errorCallbackURL: "/sign-in" }).catch(() => {});
    setPending(false);
    setSent(true);
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
            setSent(false);
          }}
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Email me a sign-in link"}
      </Button>
      {sent && (
        <p role="status" className="text-sm text-muted-foreground">
          {SENT_MESSAGE}
        </p>
      )}
    </form>
  );
}
