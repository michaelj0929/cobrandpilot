import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { BRAND_KIND_LABEL, getBrandFamilyOf } from "@/lib/cobrand-client";

/** Compact master › sub-brand switcher; keeps you in the same section. */
export function BrandScopePicker({
  brandId,
  to,
  label,
}: {
  brandId: string;
  to: "/brands/$brandId" | "/brands/$brandId/brain" | "/brands/$brandId/check";
  label: string;
}) {
  const family = useQuery({
    queryKey: ["family-of", brandId],
    queryFn: () => getBrandFamilyOf(brandId),
  });
  const master = family.data?.master;
  if (!master) return null;
  const subs = family.data?.subBrands ?? [];

  const pill = (active: boolean, small: boolean) =>
    cn(
      "inline-flex items-center rounded-full border transition-colors",
      small ? "h-7 px-3 text-xs" : "h-8 px-3.5 text-[13px] font-semibold",
      active
        ? "border-foreground bg-foreground text-background"
        : "border-line-soft text-ink-muted hover:text-ink",
    );

  return (
    <nav aria-label={label} className="mb-6 flex flex-wrap items-center gap-1.5">
      <span className="mr-1.5 text-xs text-ink-muted">{label}</span>
      <Link
        to={to}
        params={{ brandId: master.id }}
        aria-current={master.id === brandId ? "page" : undefined}
        className={pill(master.id === brandId, false)}
      >
        {master.name}
      </Link>
      {subs.length > 0 ? <ChevronRight aria-hidden className="size-3.5 text-ink-muted" /> : null}
      {subs.map((b) => (
        <Link
          key={b.id}
          to={to}
          params={{ brandId: b.id }}
          title={BRAND_KIND_LABEL[b.kind]}
          aria-current={b.id === brandId ? "page" : undefined}
          className={pill(b.id === brandId, true)}
        >
          {b.name}
        </Link>
      ))}
    </nav>
  );
}
