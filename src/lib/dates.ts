/** Local calendar date as "YYYY-MM-DD" (not UTC, so "today" matches the clinic's day). */
export function localISODate(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
