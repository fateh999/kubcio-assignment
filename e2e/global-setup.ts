import { MAILPIT_URL } from "./helpers";

/** Fails fast with a clear message if Mailpit (and so Docker) isn't running. */
export default async function globalSetup() {
  try {
    const res = await fetch(`${MAILPIT_URL}/api/v1/info`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    throw new Error(`Mailpit isn't reachable at ${MAILPIT_URL} (${(e as Error).message}). Run \`docker compose up -d\` first.`);
  }
}
