import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 sm:px-10">
          <Link to="/" className="group flex items-baseline gap-2.5">
            <span className="display text-[1.6rem] leading-none">CoBrand</span>
            <span
              className="hidden h-3 w-px sm:block"
              style={{ backgroundColor: "var(--brand-accent)" }}
              aria-hidden
            />
            <span className="eyebrow hidden sm:block">brand truth engine</span>
          </Link>
          <nav className="flex items-center gap-7 text-sm text-muted-foreground">
            <Link to="/" className="transition-colors hover:text-foreground">
              Brands
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-14 sm:px-10 sm:py-20">{children}</main>
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
    <div className="mb-14 flex flex-wrap items-end justify-between gap-6">
      <div className="max-w-2xl">
        {eyebrow ? <p className="eyebrow mb-4">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="lede mt-5">{description}</p> : null}
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
    confirmed: "text-[var(--confirmed)] bg-[var(--confirmed)]/10",
    inferred: "text-[var(--inferred)] bg-[var(--inferred)]/12",
    proposed: "text-[var(--inferred)] bg-[var(--inferred)]/12",
    missing: "text-[var(--missing)] bg-[var(--missing)]/10",
    vague: "text-[var(--inferred)] bg-[var(--inferred)]/12",
    archived: "text-muted-foreground bg-muted",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize tracking-wide ${
        map[state] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {label ?? state}
    </span>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="surface-quiet border-dashed px-8 py-14 text-center">
      <p className="display text-2xl">{title}</p>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

/** Section header used across the drill-down screens. */
export function SectionHead({
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
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-xl">
        {eyebrow ? <p className="eyebrow mb-2.5">{eyebrow}</p> : null}
        <h2>{title}</h2>
        {description ? (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions}
    </div>
  );
}
