import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CornerDownRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { BRAND_KIND_LABEL, getBrandFamilyOf } from "@/lib/cobrand-client";

/**
 * Master brand on top, sub-brands and product lines nested beneath it.
 * Selecting one keeps you in the same section (Uploads or Brand System).
 */
export function BrandScopePicker({
  brandId,
  to,
  label,
}: {
  brandId: string;
  to: "/brands/$brandId" | "/brands/$brandId/brain";
  label: string;
}) {
  const family = useQuery({
    queryKey: ["family-of", brandId],
    queryFn: () => getBrandFamilyOf(brandId),
  });
  const master = family.data?.master;
  if (!master) return null;
  const subs = family.data?.subBrands ?? [];

  const item = (active: boolean) =>
    cn(
      "flex min-h-11 items-center justify-between gap-3 rounded-md border px-4 text-sm transition-colors",
      active
        ? "border-foreground bg-foreground text-background"
        : "border-line-soft bg-card hover:bg-brand-tint/40",
    );

  return (
    <nav aria-label={label} className="surface mb-8 px-5 py-4">
      <p className="mb-3 text-xs text-ink-muted">{label}</p>
      <Link
        to={to}
        params={{ brandId: master.id }}
        aria-current={master.id === brandId ? "page" : undefined}
        className={item(master.id === brandId)}
      >
        <span className="font-semibold">{master.name}</span>
        <span className="text-[11px] opacity-70">Master brand</span>
      </Link>
      {subs.length > 0 ? (
        <ul className="mt-2 ml-4 flex flex-col gap-2 border-l border-line-soft pl-4">
          {subs.map((b) => (
            <li key={b.id} className="flex items-center gap-2">
              <CornerDownRight aria-hidden className="size-4 shrink-0 text-ink-muted" />
              <Link
                to={to}
                params={{ brandId: b.id }}
                aria-current={b.id === brandId ? "page" : undefined}
                className={cn(item(b.id === brandId), "flex-1")}
              >
                <span>{b.name}</span>
                <span className="text-[11px] opacity-70">{BRAND_KIND_LABEL[b.kind]}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </nav>
  );
}
