import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin, magicLink } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { MAIL_FROM, mailer } from "@/lib/mailer";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
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
});
