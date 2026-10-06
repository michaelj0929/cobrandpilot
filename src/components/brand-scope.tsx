import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { getBrandFamilyOf } from "@/lib/cobrand-client";

type ScopeRoute = "/brands/$brandId" | "/brands/$brandId/brain" | "/brands/$brandId/check";

/** Brand family panel: master brand with sub-brands and product lines beneath; keeps you in the same section. */
export function BrandScopePicker({
  brandId,
  to,
  label,
}: {
  brandId: string;
  to: ScopeRoute;
  label: string;
}) {
  const family = useQuery({
    queryKey: ["family-of", brandId],
    queryFn: () => getBrandFamilyOf(brandId),
  });
  const master = family.data?.master;
  if (!master) return null;
  const subs = family.data?.subBrands ?? [];
  const groups = [
    { title: "Sub-brands", items: subs.filter((b) => b.kind === "sub_brand") },
    { title: "Product lines", items: subs.filter((b) => b.kind === "product_line") },
  ].filter((g) => g.items.length > 0);
  const onMaster = master.id === brandId;

  const chip = (active: boolean) =>
    cn(
      "inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium transition-colors",
      active
        ? "border-foreground bg-foreground text-background"
        : "border-line-soft bg-card text-ink hover:border-foreground/30",
    );

  return (
    <nav aria-label={label} className="mb-6">
      <p className="eyebrow mb-2">{label}</p>
      <div className="inline-flex max-w-full flex-col rounded-lg border border-line-soft bg-card px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Link
            to={to}
            params={{ brandId: master.id }}
            aria-current={onMaster ? "page" : undefined}
            className={cn(chip(onMaster), "font-semibold")}
          >
            {master.name}
          </Link>
          <span className="text-xs text-ink-muted">Master brand</span>
        </div>

        {groups.length > 0 ? (
          <div className="ml-3.5 mt-2 border-l border-line-soft">
            {groups.map((g) => (
              <div key={g.title} className="flex items-center gap-3 py-1.5">
                <span aria-hidden className="h-px w-3 bg-line-soft" />
                <span className="w-24 shrink-0 text-xs text-ink-muted">{g.title}</span>
                <div className="flex flex-wrap gap-1.5">
                  {g.items.map((b) => (
                    <Link
                      key={b.id}
                      to={to}
                      params={{ brandId: b.id }}
                      aria-current={b.id === brandId ? "page" : undefined}
                      className={chip(b.id === brandId)}
                    >
                      {b.name}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-ink-muted">No sub-brands or product lines yet</p>
        )}
      </div>

      {!onMaster ? (
        <p className="mt-2 text-xs text-ink-muted">
          Built on{" "}
          <Link to={to} params={{ brandId: master.id }} className="font-semibold text-brand hover:underline">
            {master.name}
          </Link>{" "}
          · {master.name}'s Must rules still apply
        </p>
      ) : null}
    </nav>
  );
}
