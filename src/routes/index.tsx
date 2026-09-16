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

  return (
    <AppShell>
      <PageHead
        eyebrow="Pilot"
        title="Your brands"
        description="Feed CoBrand your guidelines and it builds a brand model you can interrogate, correct and review creative against."
        actions={
          <Button onClick={() => setOpen((v) => !v)}>{open ? "Cancel" : "New brand"}</Button>
        }
      />

      {open ? (
        <div className="reveal-enter surface mb-14 p-8">
          <h2>Start a brand</h2>
          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="name">Brand name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                placeholder="e.g. financial services"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="market">Primary market</Label>
              <Input
                id="market"
                placeholder="e.g. UK"
                value={market}
                onChange={(e) => setMarket(e.target.value)}
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
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
            className="mt-7"
            disabled={!name.trim() || createBrand.isPending}
            onClick={() => createBrand.mutate()}
          >
            {createBrand.isPending ? "Creating…" : "Create brand"}
          </Button>
          {createBrand.isError ? (
            <p className="mt-4 text-sm text-destructive">
              {(createBrand.error as Error).message}
            </p>
          ) : null}
        </div>
      ) : null}

      {brands.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (brands.data ?? []).length === 0 ? (
        <Empty
          title="No brands yet"
          body="Create a brand, then upload its guidelines, decks and approved work. CoBrand reads them and builds the model."
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {(brands.data ?? []).map((brand, i) => (
            <Link
              key={brand.id}
              to="/brands/$brandId"
              params={{ brandId: brand.id }}
              className="rise-enter surface surface-hover group flex flex-col p-8"
              style={{ animationDelay: `${Math.min(i, 6) * 50}ms` }}
            >
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-[2rem]">{brand.name}</h2>
                <span className="eyebrow shrink-0 pt-2">v{brand.current_version}</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {[brand.category, brand.primary_market].filter(Boolean).join(" · ") ||
                  "No category set"}
              </p>
              {brand.description ? (
                <p className="mt-5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                  {brand.description}
                </p>
              ) : null}
              <span
                className="mt-7 h-px w-12 origin-left transition-transform duration-300 group-hover:scale-x-[2.5]"
                style={{ backgroundColor: "var(--brand-accent)" }}
                aria-hidden
              />
            </Link>
          ))}
        </div>
      )}

      {(checks.data ?? []).length > 0 ? (
        <section className="mt-24">
          <SectionHead
            eyebrow="Activity"
            title="Recent reviews"
            description="Every creative CoBrand has judged against a brand model."
          />
          <div className="surface divide-y divide-border/60">
            {(checks.data ?? []).slice(0, 8).map((check) => (
              <Link
                key={check.id}
                to="/reviews/$checkId"
                params={{ checkId: check.id }}
                className="flex items-center gap-6 px-7 py-5 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {check.asset_name ?? check.label ?? "Copy review"}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {check.brands?.name} · {check.status}
                  </p>
                  <div className="mt-3 max-w-xs">
                    <Meter value={check.score} />
                  </div>
                </div>
                <ScoreRing value={check.score} size={52} />
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}

