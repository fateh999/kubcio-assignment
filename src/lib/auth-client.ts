import { adminClient, magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// Client-side auth (SPEC §5.1). Used by /sign-in and the admin page in #2.
export const authClient = createAuthClient({
  plugins: [magicLinkClient(), adminClient()],
});
