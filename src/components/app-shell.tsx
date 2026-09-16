import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/70 bg-background/85 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="display text-2xl leading-none">CoBrand</span>
            <span className="eyebrow">brand truth engine</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm text-muted-foreground">
            <Link to="/" className="transition-colors hover:text-foreground">
              Brands
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}

export function PageHead({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h1 className="text-4xl leading-tight">{title}</h1>
        {description ? <p className="mt-3 text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatusDot({ state }: { state: "confirmed" | "inferred" | "missing" }) {
  const color =
    state === "confirmed"
      ? "bg-[var(--confirmed)]"
      : state === "inferred"
        ? "bg-[var(--inferred)]"
        : "bg-[var(--missing)]";
  return <span className={`inline-block size-2 rounded-full ${color}`} aria-hidden />;
}

export function StateBadge({ state, label }: { state: string; label?: string }) {
  const map: Record<string, string> = {
    confirmed: "border-[var(--confirmed)]/40 text-[var(--confirmed)] bg-[var(--confirmed)]/8",
    inferred: "border-[var(--inferred)]/40 text-[var(--inferred)] bg-[var(--inferred)]/10",
    proposed: "border-[var(--inferred)]/40 text-[var(--inferred)] bg-[var(--inferred)]/10",
    missing: "border-[var(--missing)]/40 text-[var(--missing)] bg-[var(--missing)]/8",
    vague: "border-[var(--inferred)]/40 text-[var(--inferred)] bg-[var(--inferred)]/10",
    archived: "border-border text-muted-foreground bg-muted",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${
        map[state] ?? "border-border text-muted-foreground"
      }`}
    >
      {label ?? state}
    </span>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card/50 px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
