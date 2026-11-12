import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic check only: a request with no session cookie gets a real HTTP redirect to /sign-in.
 * It does not validate the session, the role or deactivation. requireUser() does that on every
 * page and server action (SPEC §5.4).
 *
 * Without this, signed-out visitors to a partially prerendered page get a 200 with a redirect
 * streamed inside it (no protected content, but not a proper redirect).
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Everything except the sign-in and forbidden pages, the auth API, and static assets.
  matcher: ["/((?!sign-in|forbidden|api/auth|_next/static|_next/image|favicon.ico).*)"],
};
