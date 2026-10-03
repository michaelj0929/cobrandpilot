import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { AppShell, Empty, PageHead, SectionHead } from "@/components/app-shell";
import { Meter, ScoreRing } from "@/components/visuals";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { listBrands, listChecks } from "@/lib/cobrand-client";

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
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [market, setMarket] = useState("");
  const [description, setDescription] = useState("");

  const brands = useQuery({ queryKey: ["brands"], queryFn: listBrands });
  const checks = useQuery({ queryKey: ["checks"], queryFn: () => listChecks() });

  const createBrand = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .insert({
          name: name.trim(),
          category: category.trim() || null,
          primary_market: market.trim() || null,
          description: description.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      navigate({ to: "/brands/$brandId", params: { brandId: id } });
    },
  });

  const scored = (checks.data ?? []).filter((c) => c.score !== null);
  const averageScore =
    scored.length > 0
      ? Math.round(scored.reduce((sum, c) => sum + (c.score ?? 0), 0) / scored.length)
      : null;

  return (
    <AppShell>
      <PageHead
        title="Your brands"
        description="Feed CoBrand your guidelines and it builds a brand model you can interrogate, correct and review creative against."
        actions={
          <Button onClick={() => setOpen((v) => !v)}>{open ? "Cancel" : "New brand"}</Button>
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
          <h2 className="text-[13px] leading-[18px] tracking-[0.2px]">Brands</h2>
          <span className="stat">{brands.data?.length ?? "–"}</span>
          <span className="text-xs text-ink-muted">brand models</span>
        </section>
        <section className="flex flex-col gap-1 rounded-lg bg-sky-tint px-6 py-[22px]">
          <h2 className="text-[13px] leading-[18px] tracking-[0.2px]">Reviews</h2>
          <span className="stat">{checks.data?.length ?? "–"}</span>
          <span className="text-xs text-ink-muted">creatives reviewed</span>
        </section>
      </div>

      {open ? (
        <div className="reveal-enter surface mb-7 px-6 py-[22px]">
          <h2>Start a brand</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div className="grid gap-1.5">
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
            disabled={!name.trim() || createBrand.isPending}
            onClick={() => createBrand.mutate()}
          >
            {createBrand.isPending ? "Creating…" : "Create brand"}
          </Button>
          {createBrand.isError ? (
            <p className="mt-4 text-sm text-destructive">{(createBrand.error as Error).message}</p>
          ) : null}
        </div>
      ) : null}

      {brands.isLoading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : (brands.data ?? []).length === 0 ? (
        <Empty
          title="No brands yet"
          body="Create a brand, then upload its guidelines, decks and approved work. CoBrand reads them and builds the model."
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {(brands.data ?? []).map((brand, i) => (
            <Link
              key={brand.id}
              to="/brands/$brandId"
              params={{ brandId: brand.id }}
              className="rise-enter surface surface-hover flex flex-col gap-2 px-6 py-[22px]"
              style={{ animationDelay: `${Math.min(i, 6) * 50}ms` }}
            >
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-xl leading-7">{brand.name}</h2>
                <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-brand-tint px-2.5 text-xs font-semibold text-brand">
                  v{brand.current_version}
                </span>
              </div>
              <p className="text-[13px] text-ink-muted">
                {[brand.category, brand.primary_market].filter(Boolean).join(" · ") ||
                  "No category set"}
              </p>
              {brand.description ? (
                <p className="line-clamp-2 text-sm">{brand.description}</p>
              ) : null}
            </Link>
          ))}
        </div>
      )}

      {(checks.data ?? []).length > 0 ? (
        <section className="surface mt-7 px-6 py-[22px]">
          <SectionHead
            title="Recent reviews"
            description="Every creative CoBrand has judged against a brand model."
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
