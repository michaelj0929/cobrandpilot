import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  House,
  LayoutGrid,
  Menu,
  Settings,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { displayName, useAuthUser } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

/** The brand the current page belongs to; scopes the brand nav items. */
export type ShellBrand = {
  id: string;
  name?: string | null;
  version?: number | null;
  /** Set for a sub-brand / product line: its master brand. */
  master?: { id: string; name: string } | null;
  kindLabel?: string | null;
  /** Workspace the brand lives in; "Home" goes back to its dashboard. */
  workspaceId?: string | null;
};

export function AppShell({ brand, workspaceId, children }: { brand?: ShellBrand; workspaceId?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-page md:flex-row">
      <SideNav brand={brand} workspaceId={workspaceId ?? brand?.workspaceId} />
      <main className="min-w-0 flex-1 px-[18px] py-7 md:px-14 md:pt-16 md:pb-12">
        <div className="mx-auto w-full max-w-[1040px]">{children}</div>
      </main>
    </div>
  );
}

const navItem =
  "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-ink-muted transition-colors";

function SideNav({ brand, workspaceId }: { brand?: ShellBrand | undefined; workspaceId?: string | null }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = useAuthUser();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    setCollapsed(window.localStorage.getItem("cobrand-nav-collapsed") === "true");
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((previous) => {
      window.localStorage.setItem("cobrand-nav-collapsed", String(!previous));
      return !previous;
    });
  };
  const brandBase = brand ? `/brands/${brand.id}` : null;
  // Checks always run on the master brand; a sub-brand is pre-selected.
  const masterId = brand ? (brand.master?.id ?? brand.id) : null;

  const isOn = {
    home: workspaceId ? pathname === `/workspaces/${workspaceId}` : pathname === "/workspaces" || pathname === "/workspaces/",
    settings: pathname.startsWith("/settings"),
    uploads: brandBase !== null && pathname === brandBase,
    system: brandBase !== null && pathname.startsWith(`${brandBase}/brain`),
    checks:
      (masterId !== null && pathname.startsWith(`/brands/${masterId}/review`)) ||
      pathname.startsWith("/reviews/"),
  };

  const itemClass = (active: boolean) => cn(navItem, "hover:bg-page hover:text-ink", collapsed && "md:justify-center md:px-0", active && on);
  const labelClass = cn(collapsed && "md:sr-only");

  return (
    <nav
      aria-label="Main"
      className={cn("flex flex-col gap-0.5 border-b border-line-soft bg-card p-4 md:sticky md:top-0 md:h-screen md:shrink-0 md:border-r md:border-b-0 md:pt-8 md:pb-6 md:transition-[width,padding] md:duration-200", collapsed ? "md:w-[72px] md:px-3" : "md:w-[236px] md:px-4")}
    >
      <div className={cn("flex items-start justify-between gap-1 pb-3 md:pb-8", collapsed && "md:flex-col md:items-center md:pb-4")}>
        <Link
          to="/workspaces"
          aria-label="CoBrand home"
          title="Workspaces"
          className={cn("inline-flex flex-col self-start px-3 text-[26px] leading-[0.8] font-extrabold text-ink", collapsed && "md:px-1 md:text-xl")}
        >
          <span>co</span>
          <span className={cn(collapsed && "md:sr-only")}>brand</span>
        </Link>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label={mobileOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileOpen} onClick={() => setMobileOpen((value) => !value)}>
          <Menu aria-hidden />
        </Button>
        <Button variant="ghost" size="icon" className="hidden shrink-0 md:inline-flex" aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} title={collapsed ? "Expand navigation" : "Collapse navigation"} aria-expanded={!collapsed} onClick={toggleCollapsed}>
          {collapsed ? <ChevronRight aria-hidden /> : <ChevronLeft aria-hidden />}
        </Button>
      </div>

      <div className={cn("flex flex-col gap-0.5 md:flex md:min-h-0 md:flex-1", !mobileOpen && "hidden")} onClick={() => setMobileOpen(false)}>

      {brand && !collapsed ? (
        <div className="hidden px-3 pb-5 md:block">
          <p className="text-xs text-ink-muted">{brand.kindLabel ?? "Brand"}</p>
          <p className="truncate text-sm font-semibold text-ink">{brand.name ?? "…"}</p>
          {brand.master ? (
            <Link
              to="/brands/$brandId/brain"
              params={{ brandId: brand.master.id }}
              className="block truncate text-xs text-brand hover:text-brand-deep"
            >
              under {brand.master.name}
            </Link>
          ) : brand.version ? (
            <p className="text-xs text-ink-muted">Brand model v{brand.version}</p>
          ) : null}
        </div>
      ) : null}

      {workspaceId ? (
        <Link
          to="/workspaces/$workspaceId"
          params={{ workspaceId }}
          title="Home"
          aria-label="Home"
          className={itemClass(isOn.home)}
        >
          <NavIcon icon={House} />
          <span className={labelClass}>Home</span>
        </Link>
      ) : (
        <Link
          to="/workspaces"
          title="Workspaces"
          aria-label="Workspaces"
          className={itemClass(isOn.home)}
        >
          <NavIcon icon={House} />
          <span className={labelClass}>Workspaces</span>
        </Link>
      )}
      {workspaceId ? <><BrandNavLink
        brandId={brand?.id}
        to="/brands/$brandId"
        icon={Upload}
        label="Uploads"
        active={isOn.uploads}
        collapsed={collapsed}
      />
      <BrandNavLink
        brandId={brand?.id}
        to="/brands/$brandId/brain"
        icon={LayoutGrid}
        label="Brand System"
        active={isOn.system}
        collapsed={collapsed}
      />
      {masterId ? (
        <Link
          to="/brands/$brandId/review"
          params={{ brandId: masterId }}
          search={brand?.master ? { with: brand.id } : {}}
          title="Checks"
          aria-label="Checks"
          className={itemClass(isOn.checks)}
        >
          <NavIcon icon={CircleCheck} />
          <span className={labelClass}>Checks</span>
        </Link>
      ) : (
        <BrandNavLink
          brandId={undefined}
          to="/brands/$brandId/review"
          icon={CircleCheck}
          label="Checks"
          active={false}
          collapsed={collapsed}
        />
      )}
      <SoonItem icon={Activity} label="Activity" collapsed={collapsed} /></> : null}

      <div className="hidden min-h-6 flex-1 md:block" />

      <Link
        to="/settings"
        title="Settings"
        aria-label="Settings"
        className={itemClass(isOn.settings)}
      >
        <NavIcon icon={Settings} />
        <span className={labelClass}>Settings</span>
      </Link>
      <Link
        to="/settings"
        aria-label="Your account"
        title="Your account"
        className={cn("mt-2.5 flex items-center gap-2.5 rounded-md border-line-soft px-3 pt-4 transition-colors hover:text-brand md:border-t", collapsed && "md:justify-center md:px-0")}
      >
        <UserAvatar user={user} />
        <span className={cn("hidden min-w-0 md:block", collapsed && "md:sr-only")}>
          <b className="block truncate text-[13px] leading-[17px] font-semibold text-ink">
            {user ? displayName(user) : "…"}
          </b>
          <small className="block truncate text-xs leading-4 text-ink-muted">
            {user?.email ?? ""}
          </small>
        </span>
      </Link>
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
  collapsed,
}: {
  brandId: string | undefined;
  to: "/brands/$brandId" | "/brands/$brandId/brain" | "/brands/$brandId/review";
  icon: LucideIcon;
  label: string;
  active: boolean;
  collapsed: boolean;
}) {
  if (!brandId) {
    return (
      <span
        aria-disabled
        title="Open a brand first"
        className={cn(navItem, "cursor-not-allowed opacity-60", collapsed && "md:justify-center md:px-0")}
        title={label}
      >
        <NavIcon icon={icon} />
        <span className={cn(collapsed && "md:sr-only")}>{label}</span>
      </span>
    );
  }
  return (
    <Link
      to={to}
      params={{ brandId }}
      title={label}
      aria-label={label}
      className={cn(navItem, "hover:bg-page hover:text-ink", collapsed && "md:justify-center md:px-0", active && on)}
    >
      <NavIcon icon={icon} />
      <span className={cn(collapsed && "md:sr-only")}>{label}</span>
    </Link>
  );
}

/** Placeholder for a section that doesn't exist yet. */
function SoonItem({ icon, label, collapsed }: { icon: LucideIcon; label: string; collapsed: boolean }) {
  return (
    <span aria-disabled title={`${label} (soon)`} className={cn(navItem, "cursor-not-allowed", collapsed && "md:justify-center md:px-0")}>
      <NavIcon icon={icon} />
      <span className={cn("opacity-70", collapsed && "md:sr-only")}>{label}</span>
      <span className={cn("ml-auto rounded-full bg-page px-2 text-[11px] leading-5 font-semibold text-ink-muted", collapsed && "md:hidden")}>
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
