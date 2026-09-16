import { createFileRoute, Link, Outlet, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/app-shell";
import { getBrand } from "@/lib/cobrand-client";

export const Route = createFileRoute("/brands/$brandId")({
  head: () => ({
    meta: [
      { title: "Brand model — CoBrand" },
      {
        name: "description",
        content: "Sources, extracted rules, setup gaps and creative reviews for this brand.",
      },
      { property: "og:title", content: "Brand model — CoBrand" },
      {
        property: "og:description",
        content: "Sources, extracted rules, setup gaps and creative reviews for this brand.",
      },
    ],
  }),
  component: BrandLayout,
});

function BrandLayout() {
  const { brandId } = useParams({ from: "/brands/$brandId" });
  const brand = useQuery({ queryKey: ["brand", brandId], queryFn: () => getBrand(brandId) });

  const tabs = [
    { to: "/brands/$brandId", label: "Sources & gaps", exact: true },
    { to: "/brands/$brandId/brain", label: "Brand Brain", exact: false },
    { to: "/brands/$brandId/review", label: "Review creative", exact: false },
  ] as const;

  return (
    <AppShell>
      <div className="mb-8">
        <p className="eyebrow mb-2">Brand</p>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-4xl leading-tight">{brand.data?.name ?? "…"}</h1>
          <span className="text-sm text-muted-foreground">
            Brand model v{brand.data?.current_version ?? 1}
          </span>
        </div>
        <nav className="mt-6 flex flex-wrap gap-1 border-b border-border">
          {tabs.map((tab) => (
            <Link
              key={tab.label}
              to={tab.to}
              params={{ brandId }}
              activeOptions={{ exact: tab.exact }}
              className="-mb-px border-b-2 border-transparent px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "border-foreground text-foreground font-medium" }}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
      <Outlet />
    </AppShell>
  );
}
