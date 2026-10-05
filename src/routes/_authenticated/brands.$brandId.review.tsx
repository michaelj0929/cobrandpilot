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
import { CreatableCombobox } from "@/components/ui/creatable-combobox";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import {
  AUDIENCES,
  BRAND_KIND_LABEL,
  CREATIVE_TYPES,
  MAX_FILE_BYTES,
  OBJECTIVES,
  getBrandFamilyOf,
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
  const [assets, setAssets] = useState<File[]>([]);
  const asset = assets[0] ?? null;
  const today = new Date().toISOString().slice(0, 10);
  const [title, setTitle] = useState("");
  const [reviewDate, setReviewDate] = useState(today);
  const [deadline, setDeadline] = useState("");
  const [creating, setCreating] = useState("");
  const [objective, setObjective] = useState("");
  const [audience, setAudience] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const projectReady = !!title.trim() && !!reviewDate && !!creating && !!objective && !!audience;
  const [context, setContext] = useState<Record<string, string>>({});
  const [keyMessage, setKeyMessage] = useState("");
  const [checkId, setCheckId] = useState<string | null>(null);
  const [report, setReport] = useState<Readiness | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);


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
      const picked = Object.fromEntries(
        Object.entries(result).filter(([k, v]) => v && k !== "key_message") as [string, string][],
      );
      if (picked["format"] && !creating) setCreating(picked["format"]);
      if (picked["objective"] && !objective) setObjective(picked["objective"]);
      if (picked["audience"] && !audience) setAudience(picked["audience"]);
      delete picked["format"];
      delete picked["objective"];
      delete picked["audience"];
      setContext((c) => ({ ...c, ...picked }));
      if (result.key_message) setKeyMessage(result.key_message);
    },
    onSettled: () => setBusy(null),
    onError: (e) => setError((e as Error).message),
  });

  const subBrandIds = selectedSubs.filter((id) => subBrands.some((b) => b.id === id));

  const ensureProject = async () => {
    if (projectId) return projectId;
    const { data, error: projectError } = await supabase
      .from("review_projects")
      .insert({
        brand_id: brandId,
        title: title.trim(),
        review_date: reviewDate,
        deadline: deadline || null,
        creating,
        objective,
        audience,
      })
      .select("id")
      .single();
    if (projectError) throw projectError;
    setProjectId(data.id);
    return data.id;
  };

  const createCheck = async (asset: File | null = assets[0] ?? null) => {
    const project = await ensureProject();
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
      project_id: project,
      creative_context: {
        ...context,
        format: creating,
        objective,
        audience,
        ...(keyMessage ? { key_message: keyMessage } : {}),
      },
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
      const first = checkId ?? (await createCheck(assets[0] ?? null));
      const ids = [first];
      for (const file of assets.slice(1)) ids.push(await createCheck(file));
      for (const [i, id] of ids.entries()) {
        setBusy(
          ids.length > 1
            ? `Reviewing asset ${i + 1} of ${ids.length}…`
            : "Reviewing against the brand model…",
        );
        await review({ data: { checkId: id } });
      }
      if (ids.length === 1) navigate({ to: "/reviews/$checkId", params: { checkId: first } });
      else navigate({ to: "/brands/$brandId/reviews", params: { brandId } });
    },
    onSettled: () => setBusy(null),
    onError: (e) => setError((e as Error).message),
  });

  const hasInput =
    projectReady && (brief.trim().length > 10 || copy.trim().length > 5 || assets.length > 0);

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
            <h2>Review project</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Group every asset for one piece of work under a single review. All fields marked * are
              required.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="title">Review title *</Label>
                <Input
                  id="title"
                  placeholder="e.g. Spring launch — paid social"
                  value={title}
                  disabled={!!projectId}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="review_date">Review date *</Label>
                <Input id="review_date" type="date" value={reviewDate} disabled={!!projectId} onChange={(e) => setReviewDate(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="deadline">Deadline</Label>
                <Input id="deadline" type="date" value={deadline} min={reviewDate} disabled={!!projectId} onChange={(e) => setDeadline(e.target.value)} />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="creating">What are you creating? *</Label>
                <CreatableCombobox id="creating" value={creating} onValueChange={setCreating} options={CREATIVE_TYPES} placeholder="Select or type a format" searchPlaceholder="Search or add a format…" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="objective">What is the objective? *</Label>
                <CreatableCombobox id="objective" value={objective} onValueChange={setObjective} options={OBJECTIVES} placeholder="Select or type an objective" searchPlaceholder="Search or add an objective…" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="audience">Who is this for? *</Label>
                <CreatableCombobox id="audience" value={audience} onValueChange={setAudience} options={AUDIENCES} placeholder="Select or type an audience" searchPlaceholder="Search or add an audience…" />
              </div>
            </div>
          </section>

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
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length) setAssets((current) => [...current, ...files]);
                  e.target.value = "";
                  setCheckId(null);
                  setReport(null);
                }}
              />
              <div className="mt-1.5 flex flex-wrap items-center gap-3 rounded-md border-[1.5px] border-dashed border-brand-soft px-4 py-3">
                <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()}>
                  {assets.length ? "Add more files" : "Choose files"}
                </Button>
                <span className="min-w-0 truncate text-sm text-ink-muted">
                  {assets.length
                    ? `${assets.length} ${assets.length === 1 ? "asset" : "assets"} in this review`
                    : "PNG, JPG, WEBP, SVG or PDF — add as many as belong to this review"}
                </span>
              </div>
              {assets.length ? (
                <ul className="mt-2 text-sm">
                  {assets.map((file, i) => (
                    <li key={`${file.name}-${i}`} className="flex items-center justify-between gap-3 border-t border-line-soft py-2 first:border-t-0">
                      <span className="truncate">{file.name}</span>
                      <Button
                        variant="link"
                        size="sm"
                        className="px-0"
                        disabled={!!busy}
                        onClick={() => {
                          setAssets((current) => current.filter((_, j) => j !== i));
                          setCheckId(null);
                          setReport(null);
                        }}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
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

        </aside>
      </div>
    </>
  );
}
