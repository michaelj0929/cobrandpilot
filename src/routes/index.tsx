import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ArrowRight, LayoutGrid, Upload } from "lucide-react";

import { AppShell, Empty, PageHead, SectionHead } from "@/components/app-shell";
import { Meter, ScoreRing } from "@/components/visuals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  BRAND_KIND_LABEL,
  createBrand,
  getBrandFamily,
  listChecks,
  type Brand,
} from "@/lib/cobrand-client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CoBrand — Brand truth for every creative" },
      {
        name: "description",
        content:
          "Build a living brand model from your guidelines, see what is confirmed, inferred or missing, and review creative in context.",
      },
      { property: "og:title", content: "CoBrand — Brand truth for every creative" },
      {
        property: "og:description",
        content: "Build a living brand model and review creative against it, in context.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const family = useQuery({ queryKey: ["brand-family"], queryFn: getBrandFamily });
  const checks = useQuery({ queryKey: ["checks"], queryFn: () => listChecks() });

  if (family.isLoading) {
    return (
      <AppShell>
        <p className="text-sm text-ink-muted">Loading…</p>
      </AppShell>
    );
  }

  const master = family.data?.master ?? null;
  if (!master) {
    return (
      <AppShell>
        <MasterBrandSetup />
      </AppShell>
    );
  }

  const subBrands = family.data?.subBrands ?? [];
  const scored = (checks.data ?? []).filter((c) => c.score !== null);
  const averageScore =
    scored.length > 0
      ? Math.round(scored.reduce((sum, c) => sum + (c.score ?? 0), 0) / scored.length)
      : null;

  return (
    <AppShell
      brand={{
        id: master.id,
        name: master.name,
        version: master.current_version,
        kindLabel: "Master brand",
      }}
    >
      <PageHead
        title={master.name}
        description="Your master brand system is the knowledge base every check runs against. Sub-brands and product lines add their own guidelines on top."
        actions={
          <Button asChild>
            <Link to="/brands/$brandId/review" params={{ brandId: master.id }}>
              <ArrowRight aria-hidden />
              Check content
            </Link>
          </Button>
        }
      />

      <div className="mb-7 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5">
        <section className="flex flex-col gap-3.5 rounded-lg bg-brand-tint px-6 py-[22px]">
          <h2 className="text-[13px] leading-[18px] tracking-[0.2px]">Average score</h2>
          <div className="flex items-center gap-4">
            <ScoreRing value={averageScore} size={80} />
            <span className="text-[13px] leading-5 font-semibold">
              across {scored.length} {scored.length === 1 ? "review" : "reviews"}
            </span>
          </div>
        </section>
        <section className="flex flex-col gap-1 rounded-lg bg-yellow-tint px-6 py-[22px]">
          <h2 className="text-[13px] leading-[18px] tracking-[0.2px]">Sub-brands</h2>
          <span className="stat">{subBrands.length}</span>
          <span className="text-xs text-ink-muted">sub-brands and product lines</span>
        </section>
        <section className="flex flex-col gap-1 rounded-lg bg-sky-tint px-6 py-[22px]">
          <h2 className="text-[13px] leading-[18px] tracking-[0.2px]">Reviews</h2>
          <span className="stat">{checks.data?.length ?? "–"}</span>
          <span className="text-xs text-ink-muted">creatives reviewed</span>
        </section>
      </div>

      <BrandCard brand={master} />

      <section className="mt-7">
        <SubBrandSection master={master} subBrands={subBrands} />
      </section>

      {(checks.data ?? []).length > 0 ? (
        <section className="surface mt-7 px-6 py-[22px]">
          <SectionHead
            title="Recent reviews"
            description="Every creative CoBrand has judged against the brand system."
          />
          <ul>
            {(checks.data ?? []).slice(0, 8).map((check) => (
              <li key={check.id} className="border-t border-line-soft first:border-t-0">
                <Link
                  to="/reviews/$checkId"
                  params={{ checkId: check.id }}
                  className="-mx-3 flex items-center gap-4 rounded-md px-3 py-3.5 transition-colors hover:bg-page"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {check.asset_name ?? check.label ?? "Copy review"}
                    </p>
                    <p className="truncate text-xs text-ink-muted">
                      {check.brands?.name} · {check.status}
                    </p>
                    <div className="mt-2.5 max-w-xs">
                      <Meter value={check.score} />
                    </div>
                  </div>
                  <ScoreRing value={check.score} size={52} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AppShell>
  );
}

/** First run: the workspace has no master brand yet. */
function MasterBrandSetup() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [market, setMarket] = useState("");
  const [description, setDescription] = useState("");

  const create = useMutation({
    mutationFn: () => createBrand({ name, category, primaryMarket: market, description }),
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["brand-family"] });
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      navigate({ to: "/brands/$brandId", params: { brandId: id } });
    },
  });

  return (
    <div className="grid items-center gap-12 py-6 lg:grid-cols-[1fr_1fr]">
      <div className="flex flex-col gap-5">
        <h1 className="display">Your brand workspace is ready</h1>
        <p className="lede">
          Start with your master brand. Upload everything that defines it, and CoBrand organizes it
          into a living brand system that every check runs against. Sub-brands and product lines
          come after.
        </p>
      </div>

      <section className="surface px-6 py-[22px]">
        <h2>Set up your master brand</h2>
        <p className="mt-1 text-sm text-ink-muted">A workspace has one master brand.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="name">Brand name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              placeholder="e.g. financial services"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="market">Primary market</Label>
            <Input
              id="market"
              placeholder="e.g. UK"
              value={market}
              onChange={(e) => setMarket(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="description">Anything CoBrand should know</Label>
            <Textarea
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <Button
          className="mt-6"
          disabled={!name.trim() || create.isPending}
          onClick={() => create.mutate()}
        >
          <ArrowRight aria-hidden />
          {create.isPending ? "Creating…" : "Create and upload documents"}
        </Button>
        {create.isError ? (
          <p className="mt-4 text-sm text-destructive">{(create.error as Error).message}</p>
        ) : null}
      </section>
    </div>
  );
}

function SubBrandSection({ master, subBrands }: { master: Brand; subBrands: Brand[] }) {
  return (
    <>
      <SectionHead
        title="Sub-brands and product lines"
        description={`Their own guidelines, on top of ${master.name}. When you check content, pick which ones apply.`}
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link to="/brands/$brandId" params={{ brandId: master.id }} hash="sub-brands">
              New sub-brand or product line
            </Link>
          </Button>
        }
      />

      {subBrands.length === 0 ? (
        <Empty
          title="No sub-brands yet"
          body="Add a sub-brand or product line from Uploads, along with the guidelines that only apply to it."
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {subBrands.map((brand) => (
            <BrandCard key={brand.id} brand={brand} />
          ))}
        </div>
      )}
    </>
  );
}

function BrandCard({ brand }: { brand: Brand }) {
  return (
    <div className="rise-enter surface flex flex-col gap-2 px-6 py-[22px]">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl leading-7">{brand.name}</h2>
        <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-brand-tint px-2.5 text-xs font-semibold text-brand">
          {BRAND_KIND_LABEL[brand.kind]} · v{brand.current_version}
        </span>
      </div>
      {brand.category || brand.primary_market ? (
        <p className="text-[13px] text-ink-muted">
          {[brand.category, brand.primary_market].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      {brand.description ? <p className="line-clamp-2 text-sm">{brand.description}</p> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="secondary">
          <Link to="/brands/$brandId" params={{ brandId: brand.id }}>
            <Upload aria-hidden />
            Upload documents
          </Link>
        </Button>
        <Button asChild size="sm" variant="quiet">
          <Link to="/brands/$brandId/brain" params={{ brandId: brand.id }}>
            <LayoutGrid aria-hidden />
            {brand.kind === "master" ? "Brand system" : "Guidelines"}
          </Link>
        </Button>
      </div>
    </div>
  );
}
