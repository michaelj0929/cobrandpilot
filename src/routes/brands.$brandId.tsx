import { createFileRoute, Outlet, useParams, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/app-shell";
import { BRAND_KIND_LABEL, getBrand } from "@/lib/cobrand-client";

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
  const parentId = brand.data?.parent_brand_id ?? null;
  const master = useQuery({
    queryKey: ["brand", parentId],
    queryFn: () => getBrand(parentId ?? ""),
    enabled: parentId !== null,
  });

  return (
    <AppShell
      brand={{
        id: brandId,
        name: brand.data?.name ?? null,
        version: brand.data?.current_version ?? null,
        kindLabel: brand.data ? BRAND_KIND_LABEL[brand.data.kind] : null,
        master: parentId && master.data ? { id: master.data.id, name: master.data.name } : null,
      }}
    >
      <div key={pathname} className="view-enter">
        <Outlet />
      </div>
    </AppShell>
  );
}
