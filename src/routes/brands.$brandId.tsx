import {
  createFileRoute,
  Link,
  Outlet,
  useParams,
  useRouterState,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";


import { AppShell } from "@/components/app-shell";
import { useBrandAccent } from "@/components/visuals";
import { getBrand, listRules } from "@/lib/cobrand-client";


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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const brand = useQuery({ queryKey: ["brand", brandId], queryFn: () => getBrand(brandId) });
  const rules = useQuery({ queryKey: ["rules", brandId], queryFn: () => listRules(brandId) });
  useBrandAccent(rules.data);



  const tabs = [
    { to: "/brands/$brandId", label: "Sources & gaps", exact: true },
    { to: "/brands/$brandId/brain", label: "Brand Brain", exact: false },
    { to: "/brands/$brandId/review", label: "Review creative", exact: false },
  ] as const;

  return (
    <AppShell>
      <div className="mb-14">
        <p className="eyebrow mb-4">Brand</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1>{brand.data?.name ?? "…"}</h1>
          <span className="pb-2 text-sm text-muted-foreground">
            Brand model v{brand.data?.current_version ?? 1}
          </span>
        </div>
        <nav className="mt-10 flex flex-wrap gap-8 border-b border-border/70">
          {tabs.map((tab) => (
            <Link
              key={tab.label}
              to={tab.to}
              params={{ brandId }}
              activeOptions={{ exact: tab.exact }}
              className="-mb-px border-b border-transparent pb-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{
                className:
                  "border-[var(--brand-accent)] text-foreground [border-bottom-width:2px]",
              }}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
      <div key={pathname} className="view-enter">
        <Outlet />
      </div>
    </AppShell>
  );
}

