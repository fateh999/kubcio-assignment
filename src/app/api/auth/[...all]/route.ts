import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// Mounts Better Auth (SPEC §5.1). Sign-in UI and guards are built in #2.
export const { GET, POST } = toNextJsHandler(auth);
