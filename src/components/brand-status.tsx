import { Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Light blue panel pairing brand status with the Brand Check entry point. */
export function BrandStatusCard({
  brandId,
  total,
  confirmed,
  review,
  missing,
}: {
  brandId: string;
  total: number;
  confirmed: number;
  review: number;
  missing: number;
}) {
  const pct = total ? Math.round((confirmed / total) * 100) : 0;
  return (
    <section className="w-full rounded-xl bg-brand-tint px-5 py-4">
      <h2 className="text-[13px] leading-[18px] tracking-[0.2px]">Brand status</h2>
      <p className="mt-1.5 text-brand">
        <span className="text-3xl font-semibold tracking-tight">{pct}%</span>
        <span className="ml-1.5 text-sm font-medium">confirmed</span>
      </p>
      <div
        className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-brand-soft"
        role="progressbar"
        aria-label="Confirmed rules"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-ink">
        {total} rules · {confirmed} confirmed · {review} to review
      </p>

      <div className="mt-4 border-t border-brand-soft pt-3.5">
        {missing > 0 ? (
          <p className="text-xs font-semibold text-[var(--missing)]">
            {missing} {missing === 1 ? "item" : "items"} missing
          </p>
        ) : (
          <p className="inline-flex items-center gap-1 text-xs font-semibold text-green">
            <Check aria-hidden className="size-3.5" />
            Nothing missing
          </p>
        )}
        <Button asChild size="sm" className="mt-2.5 w-full">
          <Link to="/brands/$brandId/check" params={{ brandId }}>
            Run Brand Check
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
    </section>
  );
}
