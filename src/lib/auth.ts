import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin, magicLink } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { MAIL_FROM, mailer } from "@/lib/mailer";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  // Better Auth rate-limits in production (magic link: 5 requests/verifications per minute per IP).
  // AUTH_RATE_LIMIT=off disables it. Only the e2e test server sets this; never set it for real use.
  rateLimit: process.env.AUTH_RATE_LIMIT === "off" ? { enabled: false } : undefined,
  plugins: [
    magicLink({
      // Only staff the admin has added can sign in.
      disableSignUp: true,
      sendMagicLink: async ({ email, url }) => {
        await mailer.sendMail({
          to: email,
          from: MAIL_FROM,
          subject: "Sign in to the clinic",
          text: `Sign in: ${url}`,
          html: `<p><a href="${url}">Sign in to the clinic</a></p>`,
        });
      },
    }),
    admin({ adminRoles: ["admin"] }),
    nextCookies(), // must stay last
  ],
  hooks: {
    // The admin plugin blocks a deactivated user's session with a BANNED_USER error, which the
    // magic-link check returns as raw JSON (HTTP 403). Before the check runs, look up whose link
    // this is and send a deactivated user to the sign-in page's message instead. The link is not
    // consumed, and the user still never gets a session.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/magic-link/verify") return;
      const token = typeof ctx.query?.token === "string" ? ctx.query.token : null;
      if (!token) return;
      const record = await ctx.context.internalAdapter.findVerificationValue(`magic-link:${token}`);
      if (!record) return; // unknown or expired: Better Auth reports INVALID_TOKEN itself
      let email: string | undefined;
      try {
        email = (JSON.parse(record.value) as { email?: string }).email;
      } catch {
        return;
      }
      if (!email) return;
      const found = await ctx.context.internalAdapter.findUserByEmail(email);
      if (found?.user && (found.user as { banned?: boolean | null }).banned === true) {
        throw ctx.redirect("/sign-in?error=deactivated");
      }
    }),
  },
});
