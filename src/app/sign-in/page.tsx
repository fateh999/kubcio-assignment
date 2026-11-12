import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/require-user";
import { SignInForm } from "./sign-in-form";

/** Error codes from Better Auth's magic-link check, plus our own "deactivated" (SPEC §5.2 step 3). */
function errorMessage(code: string | undefined): string | null {
  if (!code) return null;
  switch (code) {
    case "new_user_signup_disabled":
    case "user_not_found":
      return "This email isn't registered. Ask the clinic admin to add you.";
    case "deactivated":
    case "BANNED_USER":
      return "This account has been deactivated. Ask the clinic admin.";
    case "INVALID_TOKEN":
    case "EXPIRED_TOKEN":
      return "This sign-in link has expired or was already used. Request a new one below.";
    default:
      return "Sign-in didn't work. Request a new link below.";
  }
}

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Clinic sign-in</CardTitle>
          <CardDescription>Staff only. We&apos;ll email you a sign-in link.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Reads the session and ?error=, so it renders at request time behind a boundary. */}
          <Suspense fallback={null}>
            <SessionAndError searchParams={searchParams} />
          </Suspense>
          <SignInForm />
        </CardContent>
      </Card>
    </main>
  );
}

async function SessionAndError({ searchParams }: { searchParams: PageProps<"/sign-in">["searchParams"] }) {
  const user = await getCurrentUser();
  if (user && !user.banned) redirect("/");

  const { error } = await searchParams;
  const message = errorMessage(typeof error === "string" ? error : undefined);
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  );
}
