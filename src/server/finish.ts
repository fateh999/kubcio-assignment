import { revalidatePath } from "next/cache";
import type { ActionResult } from "./common";

/** After a successful write, refresh every page (each one shows per-user, request-time data). */
export function finish(result: ActionResult): ActionResult {
  if ("ok" in result) revalidatePath("/", "layout");
  return result;
}
