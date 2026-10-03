import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  CircleCheck,
  House,
  LayoutGrid,
  Settings,
  Upload,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** The brand the current page belongs to; scopes the brand nav items. */
export type ShellBrand = { id: string; name?: string | null; version?: number | null };

export function AppShell({ brand, children }: { brand?: ShellBrand; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-page md:flex-row">
      <SideNav brand={brand} />
      <main className="min-w-0 flex-1 px-[18px] py-7 md:px-14 md:pt-16 md:pb-12">
        <div className="mx-auto w-full max-w-[1040px]">{children}</div>
      </main>
    </div>
  );
}

const navItem =
  "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-ink-muted transition-colors";

function SideNav({ brand }: { brand?: ShellBrand | undefined }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const brandBase = brand ? `/brands/${brand.id}` : null;

  const isOn = {
    home: pathname === "/",
    uploads: brandBase !== null && pathname === brandBase,
    system: brandBase !== null && pathname.startsWith(`${brandBase}/brain`),
    checks:
      (brandBase !== null && pathname.startsWith(`${brandBase}/review`)) ||
      pathname.startsWith("/reviews/"),
  };

  return (
    <nav
      aria-label="Main"
      className="flex flex-row flex-wrap gap-0.5 border-b border-line-soft bg-card p-4 md:sticky md:top-0 md:h-screen md:w-[236px] md:shrink-0 md:flex-col md:flex-nowrap md:border-r md:border-b-0 md:px-4 md:pt-8 md:pb-6"
    >
      <Link
        to="/"
        aria-label="CoBrand home"
        className="inline-flex w-full flex-col self-start px-3 pb-3 text-[26px] leading-[0.8] font-extrabold tracking-[-0.6px] text-ink md:w-auto md:pb-8"
      >
        <span>co</span>
        <span>brand</span>
      </Link>

      {brand ? (
        <div className="hidden px-3 pb-5 md:block">
          <p className="text-xs text-ink-muted">Brand</p>
          <p className="truncate text-sm font-semibold text-ink">{brand.name ?? "…"}</p>
          {brand.version ? (
            <p className="text-xs text-ink-muted">Brand model v{brand.version}</p>
          ) : null}
        </div>
      ) : null}

      <Link to="/" className={cn(navItem, "hover:bg-page hover:text-ink", isOn.home && on)}>
        <NavIcon icon={House} />
        <span>Home</span>
      </Link>
      <BrandNavLink
        brandId={brand?.id}
        to="/brands/$brandId"
        icon={Upload}
        label="Uploads"
        active={isOn.uploads}
      />
      <BrandNavLink
        brandId={brand?.id}
        to="/brands/$brandId/brain"
        icon={LayoutGrid}
        label="Brand System"
        active={isOn.system}
      />
      <BrandNavLink
        brandId={brand?.id}
        to="/brands/$brandId/review"
        icon={CircleCheck}
        label="Checks"
        active={isOn.checks}
      />
      <SoonItem icon={Activity} label="Activity" />

      <div className="hidden min-h-6 flex-1 md:block" />

      <SoonItem icon={Settings} label="Settings" />
      <div className="mt-2.5 hidden items-center gap-2.5 border-t border-line-soft px-3 pt-4 md:flex">
        <span
          aria-hidden
          className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-peach to-orange text-xs font-bold text-ink"
        >
          ?
        </span>
        <span className="min-w-0">
          <b className="block text-[13px] leading-[17px] font-semibold text-ink">Pilot workspace</b>
          <small className="block text-xs leading-4 text-ink-muted">Sign-in coming soon</small>
        </span>
      </div>
    </nav>
  );
}

const on = "bg-brand-tint font-semibold text-brand hover:bg-brand-tint hover:text-brand";

function NavIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon aria-hidden className="size-[18px] shrink-0" strokeWidth={2} />;
}

function BrandNavLink({
  brandId,
  to,
  icon,
  label,
  active,
}: {
  brandId: string | undefined;
  to: "/brands/$brandId" | "/brands/$brandId/brain" | "/brands/$brandId/review";
  icon: LucideIcon;
  label: string;
  active: boolean;
}) {
  if (!brandId) {
    return (
      <span
        aria-disabled
        title="Open a brand first"
        className={cn(navItem, "cursor-not-allowed opacity-60")}
      >
        <NavIcon icon={icon} />
        <span>{label}</span>
      </span>
    );
  }
  return (
    <Link
      to={to}
      params={{ brandId }}
      className={cn(navItem, "hover:bg-page hover:text-ink", active && on)}
    >
      <NavIcon icon={icon} />
      <span>{label}</span>
    </Link>
  );
}

/** Placeholder for a section that doesn't exist yet. */
function SoonItem({ icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span aria-disabled className={cn(navItem, "cursor-not-allowed")}>
      <NavIcon icon={icon} />
      <span className="opacity-70">{label}</span>
      <span className="ml-auto rounded-full bg-page px-2 text-[11px] leading-5 font-semibold text-ink-muted">
        soon
      </span>
    </span>
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
    <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
      <div className="flex max-w-[600px] flex-col gap-2.5">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="lede">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
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

/** Status chip: green = on-brand/done, attention yellow = needs review. */
export function StateBadge({ state, label }: { state: string; label?: string }) {
  const map: Record<string, string> = {
    confirmed: "bg-green-tint text-green",
    inferred: "bg-attention text-ink",
    proposed: "bg-attention text-ink",
    vague: "bg-attention text-ink",
    missing: "bg-[var(--missing)]/10 text-[var(--missing)]",
    archived: "bg-page text-ink-muted",
  };
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold capitalize ${
        map[state] ?? "bg-page text-ink-muted"
      }`}
    >
      {label ?? state}
    </span>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border-[1.5px] border-dashed border-line-mid bg-card px-8 py-12 text-center">
      <h2>{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">{body}</p>
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
    <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
      <div className="flex max-w-xl flex-col gap-1.5">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
        {description ? <p className="text-sm text-ink-muted">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}
