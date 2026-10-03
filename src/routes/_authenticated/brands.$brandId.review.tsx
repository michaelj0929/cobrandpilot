import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";

import { PageHead } from "@/components/app-shell";
import { BusyLine, LoadingPanel, StepList, type Step } from "@/components/loading";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import {
  BRAND_KIND_LABEL,
  MAX_FILE_BYTES,
  getBrandFamilyOf,
  listChecks,
  uploadToBucket,
} from "@/lib/cobrand-client";
import { readBrief } from "@/lib/cobrand.functions";
import { checkReadiness, runReview } from "@/lib/review.functions";

export const Route = createFileRoute("/_authenticated/brands/$brandId/review")({
  // ?with=<sub-brand id> pre-selects a sub-brand / product line's guidelines.
  validateSearch: (search: Record<string, unknown>): { with?: string } =>
    typeof search["with"] === "string" ? { with: search["with"] } : {},
  head: () => ({
    meta: [
      { title: "Review creative — CoBrand" },
      {
        name: "description",
        content:
          "Submit a brief, copy or a visual asset and CoBrand reviews it against the brand model in context.",
      },
      { property: "og:title", content: "Review creative — CoBrand" },
      {
        property: "og:description",
        content: "Submit a brief, copy or an asset and review it against the brand model.",
      },
    ],
  }),
  component: ReviewIntake,
});

type Readiness = {
  score: number;
  needed: string[];
  available: string[];
  missing: string[];
  can_do: string;
  cannot_do: string;
};

const FIELDS = [
  { key: "format", label: "Format", placeholder: "paid social, email, OOH…" },
  { key: "objective", label: "Objective", placeholder: "awareness, conversion…" },
  { key: "audience", label: "Audience", placeholder: "who it speaks to" },
  { key: "market", label: "Market", placeholder: "UK, DACH…" },
  { key: "product", label: "Product", placeholder: "which product or service" },
  { key: "campaign", label: "Campaign", placeholder: "campaign name, if any" },
] as const;

function ReviewIntake() {
  const { brandId } = useParams({ from: "/_authenticated/brands/$brandId/review" });
  const search = Route.useSearch();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);

  const prefill = useServerFn(readBrief);
  const readiness = useServerFn(checkReadiness);
  const review = useServerFn(runReview);

  const [brief, setBrief] = useState("");
  const [copy, setCopy] = useState("");
  const [asset, setAsset] = useState<File | null>(null);
  const [context, setContext] = useState<Record<string, string>>({});
  const [keyMessage, setKeyMessage] = useState("");
  const [checkId, setCheckId] = useState<string | null>(null);
  const [report, setReport] = useState<Readiness | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const history = useQuery({
    queryKey: ["checks", brandId],
    queryFn: () => listChecks(brandId),
  });

  // Checks run on the master brand plus any selected sub-brands / product lines.
  const family = useQuery({ queryKey: ["brand-family", "of", brandId], queryFn: () => getBrandFamilyOf(brandId) });
  const subBrands = family.data?.subBrands ?? [];
  const [selectedSubs, setSelectedSubs] = useState<string[]>(search.with ? [search.with] : []);

  useEffect(() => {
    const master = family.data?.master;
    if (master && master.id !== brandId) {
      // Opened from a sub-brand: run the check on its master with it selected.
      navigate({
        to: "/brands/$brandId/review",
        params: { brandId: master.id },
        search: { with: brandId },
        replace: true,
      });
    }
  }, [family.data?.master, brandId, navigate]);

  useEffect(() => {
    if (search.with) {
      const id = search.with;
      setSelectedSubs((current) => (current.includes(id) ? current : [...current, id]));
    }
  }, [search.with]);

  const toggleSub = (id: string, on: boolean) => {
    setSelectedSubs((current) => (on ? [...current, id] : current.filter((s) => s !== id)));
    // The draft check records its guideline sets, so start a fresh one.
    setCheckId(null);
    setReport(null);
  };

  const set = (key: string, value: string) => setContext((c) => ({ ...c, [key]: value }));

  const readTheBrief = useMutation({
    mutationFn: async () => {
      setBusy("Reading the brief…");
      const result = await prefill({ data: { brief } });
      setContext((c) => ({
        ...c,
        ...Object.fromEntries(
          Object.entries(result).filter(([k, v]) => v && k !== "key_message") as [string, string][],
        ),
      }));
      if (result.key_message) setKeyMessage(result.key_message);
    },
    onSettled: () => setBusy(null),
    onError: (e) => setError((e as Error).message),
  });

  const subBrandIds = selectedSubs.filter((id) => subBrands.some((b) => b.id === id));

  const createCheck = async () => {
    let assetPath: string | null = null;
    if (asset) {
      if (asset.size > MAX_FILE_BYTES) throw new Error("That file is larger than 25 MB.");
      setBusy("Uploading the creative…");
      assetPath = await uploadToBucket("creatives", brandId, asset);
    }
    const inputType = asset
      ? copy.trim()
        ? "asset+copy"
        : "asset"
      : copy.trim()
        ? "copy"
        : "brief";
    const row = {
      brand_id: brandId,
      input_type: inputType,
      brief_text: brief.trim() || null,
      copy_text: copy.trim() || null,
      asset_path: assetPath,
      asset_name: asset?.name ?? null,
      asset_mime: asset?.type ?? null,
      creative_context: { ...context, ...(keyMessage ? { key_message: keyMessage } : {}) },
      status: "draft",
      // From migration 20261002230000; cast until types regenerate. Only sent
      // when used, so master-only checks don't depend on the new column.
      ...(subBrandIds.length > 0 ? { sub_brand_ids: subBrandIds } : {}),
    };
    const { data, error: insertError } = await supabase
      .from("validation_checks")
      .insert(row as TablesInsert<"validation_checks">)
      .select("id")
      .single();
    if (insertError) throw insertError;
    setCheckId(data.id);
    return data.id;
  };

  const assess = useMutation({
    mutationFn: async () => {
      setError(null);
      const id = checkId ?? (await createCheck());
      setBusy("Checking what CoBrand can judge…");
      const result = await readiness({ data: { checkId: id } });
      setReport(result.readiness as Readiness);
    },
    onSettled: () => setBusy(null),
    onError: (e) => setError((e as Error).message),
  });

  const submit = useMutation({
    mutationFn: async () => {
      setError(null);
      const id = checkId ?? (await createCheck());
      setBusy("Reviewing against the brand model…");
      await review({ data: { checkId: id } });
      navigate({ to: "/reviews/$checkId", params: { checkId: id } });
    },
    onSettled: () => setBusy(null),
    onError: (e) => setError((e as Error).message),
  });

  const hasInput = brief.trim().length > 10 || copy.trim().length > 5 || !!asset;

  // Real steps of the running flow, read from the busy message.
  const running = submit.isPending || assess.isPending;
  const runSteps: Step[] = (() => {
    const labels = [
      ...(asset ? ["Uploading the creative"] : []),
      assess.isPending ? "Checking what CoBrand can judge" : "Reviewing against the brand model",
    ];
    const live = busy?.startsWith("Uploading") ? 0 : labels.length - 1;
    return labels.map((label, i) => ({
      label,
      state: i < live ? "done" : i === live ? "live" : "waiting",
    }));
  })();

  return (
    <>
      <PageHead
        title="Review creative"
        description="Submit a brief, copy or a visual asset and CoBrand reviews it against the brand model in context."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[1.25fr_1fr]">
        <div className="flex flex-col gap-5">
          <section className="surface px-6 py-[22px]">
            <h2>What are you reviewing?</h2>
            <p className="mt-1 text-sm text-ink-muted">
              A brief, copy, a visual asset, or all three. CoBrand reviews whatever it is given.
            </p>

            <div className="mt-5 grid gap-1.5">
              <Label htmlFor="brief">Creative brief</Label>
              <Textarea
                id="brief"
                rows={5}
                placeholder="Paste the brief, or describe what this creative is meant to do…"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
              />
              <Button
                variant="link"
                size="sm"
                className="justify-self-start px-0"
                disabled={!!busy || brief.trim().length < 20}
                onClick={() => readTheBrief.mutate()}
              >
                Pull the context out of this brief
              </Button>
            </div>

            <div className="mt-3 grid gap-1.5">
              <Label htmlFor="copy">Copy</Label>
              <Textarea
                id="copy"
                rows={4}
                placeholder="Headline, body, CTA…"
                value={copy}
                onChange={(e) => setCopy(e.target.value)}
              />
            </div>

            <div className="mt-5">
              <Label>Visual asset</Label>
              <input
                ref={fileInput}
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.svg,.pdf"
                className="hidden"
                onChange={(e) => setAsset(e.target.files?.[0] ?? null)}
              />
              <div className="mt-1.5 flex flex-wrap items-center gap-3 rounded-md border-[1.5px] border-dashed border-brand-soft px-4 py-3">
                <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()}>
                  Choose file
                </Button>
                <span className="min-w-0 truncate text-sm text-ink-muted">
                  {asset ? asset.name : "PNG, JPG, WEBP, SVG or PDF"}
                </span>
              </div>
            </div>
          </section>

          <section className="surface px-6 py-[22px]">
            <h2>Guidelines to check against</h2>
            <p className="mt-1 text-sm text-ink-muted">
              The master brand system is always included. Add any sub-brand or product line this
              creative belongs to.
            </p>
            <ul className="mt-4 flex flex-col gap-3">
              <li className="flex items-center gap-3">
                <Checkbox id="guide-master" checked disabled aria-describedby="guide-master-note" />
                <Label htmlFor="guide-master" className="text-sm">
                  {family.data?.master?.name ?? "Master brand"}
                </Label>
                <span id="guide-master-note" className="text-xs text-ink-muted">
                  master brand · always included
                </span>
              </li>
              {subBrands.map((sub) => (
                <li key={sub.id} className="flex items-center gap-3">
                  <Checkbox
                    id={`guide-${sub.id}`}
                    checked={selectedSubs.includes(sub.id)}
                    disabled={!!busy}
                    onCheckedChange={(v) => toggleSub(sub.id, v === true)}
                  />
                  <Label htmlFor={`guide-${sub.id}`} className="cursor-pointer text-sm">
                    {sub.name}
                  </Label>
                  <span className="text-xs text-ink-muted lowercase">
                    {BRAND_KIND_LABEL[sub.kind]}
                  </span>
                </li>
              ))}
            </ul>
            {family.isSuccess && subBrands.length === 0 ? (
              <p className="mt-3 text-xs text-ink-muted">
                No sub-brands or product lines yet. Add them from Home to check against their
                guidelines too.
              </p>
            ) : null}
          </section>

          <section className="surface px-6 py-[22px]">
            <h2>Context</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Optional, but it decides which rules apply. Leave anything you don't know blank.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {FIELDS.map((field) => (
                <div key={field.key} className="grid gap-1.5">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <Input
                    id={field.key}
                    placeholder={field.placeholder}
                    value={context[field.key] ?? ""}
                    onChange={(e) => set(field.key, e.target.value)}
                  />
                </div>
              ))}
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="key_message">Key message</Label>
                <Input
                  id="key_message"
                  value={keyMessage}
                  onChange={(e) => setKeyMessage(e.target.value)}
                />
              </div>
            </div>
          </section>

          <div className="flex flex-wrap gap-3">
            <Button disabled={!hasInput || !!busy} onClick={() => submit.mutate()}>
              {busy ? busy : "Review creative"}
            </Button>
            <Button
              variant="secondary"
              disabled={!hasInput || !!busy}
              onClick={() => assess.mutate()}
            >
              Check readiness first
            </Button>
          </div>
          {busy && !running ? <BusyLine text={busy} /> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <aside className="flex flex-col gap-5">
          {running ? (
            <LoadingPanel title={busy ?? "Getting started…"}>
              <StepList steps={runSteps} />
            </LoadingPanel>
          ) : null}

          {report ? (
            <section className="rounded-lg bg-brand-tint px-6 py-[22px]">
              <h2 className="text-[13px] leading-[18px] tracking-[0.2px]">
                Brand readiness for this review
              </h2>
              <p className="stat mt-1">{Math.round(report.score)}%</p>
              <p className="text-sm">{report.can_do}</p>
              {report.cannot_do ? (
                <p className="mt-2 text-sm text-ink-muted">{report.cannot_do}</p>
              ) : null}
              {report.missing?.length ? (
                <div className="mt-4 rounded-md bg-yellow-tint px-4 py-3">
                  <p className="text-[13px] font-semibold">Missing for this review</p>
                  <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm">
                    {report.missing.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {report.available?.length ? (
                <div className="mt-3 rounded-md bg-green-tint px-4 py-3">
                  <p className="text-[13px] font-semibold text-green">Available</p>
                  <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm">
                    {report.available.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          ) : !running ? (
            <div className="rounded-lg bg-sky-tint px-5 py-4 text-sm">
              CoBrand can tell you what it is able to judge before it reviews anything — useful when
              the brand model is still thin.
            </div>
          ) : null}

          <section className="surface px-6 py-[22px]">
            <h2 className="text-[13px] leading-[18px] tracking-[0.2px]">Past reviews</h2>
            <ul className="mt-1.5 text-sm">
              {(history.data ?? []).slice(0, 8).map((check) => (
                <li key={check.id} className="border-t border-line-soft first:border-t-0">
                  <a
                    href={`/reviews/${check.id}`}
                    className="-mx-3 flex items-center justify-between gap-3 rounded-md px-3 py-3 transition-colors hover:bg-page"
                  >
                    <span className="truncate font-medium">
                      {check.asset_name ?? check.label ?? check.input_type}
                    </span>
                    <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-brand-tint px-2.5 text-xs font-semibold text-brand">
                      {check.score === null ? check.status : check.score}
                    </span>
                  </a>
                </li>
              ))}
              {(history.data ?? []).length === 0 ? (
                <li className="py-3 text-xs text-ink-muted">Nothing reviewed yet.</li>
              ) : null}
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
