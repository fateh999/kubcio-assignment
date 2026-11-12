/** Temporary page body until the task that builds the screen lands. Shows no data. */
export function Placeholder({ title, issue, spec }: { title: string; issue: number; spec: string }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-2 px-4 py-16">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-muted-foreground">
        Not built yet: task #{issue} ({spec}).
      </p>
    </main>
  );
}
