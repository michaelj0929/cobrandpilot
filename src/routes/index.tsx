import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { AppShell, Empty, PageHead } from "@/components/app-shell";
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
        <div className="mb-10 rounded-lg border border-border bg-card p-6">
          <h2 className="text-xl">Start a brand</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
            className="mt-5"
            disabled={!name.trim() || createBrand.isPending}
            onClick={() => createBrand.mutate()}
          >
            {createBrand.isPending ? "Creating…" : "Create brand"}
          </Button>
          {createBrand.isError ? (
            <p className="mt-3 text-sm text-destructive">
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
        <div className="grid gap-4 sm:grid-cols-2">
          {(brands.data ?? []).map((brand) => (
            <Link
              key={brand.id}
              to="/brands/$brandId"
              params={{ brandId: brand.id }}
              className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-foreground/30"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-2xl">{brand.name}</h2>
                <span className="eyebrow">v{brand.current_version}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {[brand.category, brand.primary_market].filter(Boolean).join(" · ") ||
                  "No category set"}
              </p>
              {brand.description ? (
                <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                  {brand.description}
                </p>
              ) : null}
            </Link>
          ))}
        </div>
      )}

      {(checks.data ?? []).length > 0 ? (
        <section className="mt-14">
          <h2 className="text-2xl">Recent reviews</h2>
          <div className="mt-4 divide-y divide-border rounded-lg border border-border bg-card">
            {(checks.data ?? []).slice(0, 8).map((check) => (
              <Link
                key={check.id}
                to="/reviews/$checkId"
                params={{ checkId: check.id }}
                className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/60"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {check.asset_name ?? check.label ?? "Copy review"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {check.brands?.name} · {check.status}
                  </p>
                </div>
                <span className="display text-xl">
                  {check.score === null ? "—" : check.score}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
