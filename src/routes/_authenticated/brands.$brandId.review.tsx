import { Upload } from "lucide-react";
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
  ACCEPTED_TYPES,
  BRAND_KIND_LABEL,
  CREATIVE_TYPES,
  MAX_FILE_BYTES,
  OBJECTIVES,
  getBrandFamilyOf,
  uploadToBucket,
} from "@/lib/cobrand-client";
import { checkReadiness, runReview } from "@/lib/review.functions";

export const Route = createFileRoute("/_authenticated/brands/$brandId/review")({
  // ?with=<sub-brand id> pre-selects a sub-brand / product line's guidelines.
  validateSearch: (search: Record<string, unknown>): { with?: string } =>
    typeof search["with"] === "string" ? { with: search["with"] } : {},
  head: () => ({
    meta: [
      { title: "Creative Review — CoBrand" },
      {
        name: "description",
        content:
          "Submit a brief, copy or a visual asset and CoBrand reviews it against the brand model in context.",
      },
      { property: "og:title", content: "Creative Review — CoBrand" },
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

type UploadedFile = { path: string; name: string; mime: string };

function ReviewIntake() {
  const { brandId } = useParams({ from: "/_authenticated/brands/$brandId/review" });
  const search = Route.useSearch();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const briefFileInput = useRef<HTMLInputElement>(null);
  const copyFileInput = useRef<HTMLInputElement>(null);
  const uploadedSupportingFiles = useRef<{
    brief: UploadedFile[];
    copy: UploadedFile[];
  } | null>(null);

  const readiness = useServerFn(checkReadiness);
  const review = useServerFn(runReview);

  const [brief, setBrief] = useState("");
  const [copy, setCopy] = useState("");
  const [briefFiles, setBriefFiles] = useState<File[]>([]);
  const [copyFiles, setCopyFiles] = useState<File[]>([]);
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

  const subBrandIds = selectedSubs.filter((id) => subBrands.some((b) => b.id === id));

  const uploadSupportingFiles = async () => {
    if (uploadedSupportingFiles.current) return uploadedSupportingFiles.current;
    const upload = async (files: File[]) =>
      Promise.all(
        files.map(async (file) => {
          if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is larger than 25 MB.`);
          return {
            path: await uploadToBucket("creatives", brandId, file),
            name: file.name,
            mime: file.type || "application/octet-stream",
          };
        }),
      );
    if (briefFiles.length || copyFiles.length) setBusy("Uploading supporting files…");
    const uploaded = {
      brief: await upload(briefFiles),
      copy: await upload(copyFiles),
    };
    uploadedSupportingFiles.current = uploaded;
    return uploaded;
  };

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
    const supporting = await uploadSupportingFiles();
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
      brief_files: supporting.brief,
      copy_files: supporting.copy,
      asset_path: assetPath,
      asset_name: asset?.name ?? null,
      asset_mime: asset?.type ?? null,
      project_id: project,
      creative_context: {
        format: creating,
        objective,
        audience,
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
    projectReady &&
    (brief.trim().length > 10 ||
      copy.trim().length > 5 ||
      briefFiles.length > 0 ||
      copyFiles.length > 0 ||
      assets.length > 0);

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
        title="Creative Review"
        description="Submit a brief, copy or a visual asset and CoBrand reviews it against the brand model in context."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="flex flex-col gap-5">
          <section className="surface flex flex-1 flex-col px-6 py-[22px]">
            <h2>Project Details</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Group every asset for one piece of work under a single review. All fields marked * are
              required.
            </p>
            <div className="mt-5 grid flex-1 content-between gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="title">Project Title *</Label>
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

          <div className="mt-auto flex flex-wrap gap-3">
            <Button disabled={!hasInput || !!busy} onClick={() => submit.mutate()}>
              {busy ? busy : "Review Creative"}
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
          <section className="surface flex flex-1 flex-col px-6 py-[22px]">
            <h2>Upload Files</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Add a creative brief, copy, creative files, or any combination of the three.
            </p>

            <div className="mt-5 grid gap-1.5">
              <Label htmlFor="brief">Creative brief</Label>
              <input
                ref={briefFileInput}
                type="file"
                accept={ACCEPTED_TYPES}
                className="hidden"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length) setBriefFiles((current) => [...current, ...files]);
                  uploadedSupportingFiles.current = null;
                  e.target.value = "";
                  setCheckId(null);
                  setReport(null);
                }}
              />
              <FilePicker
                files={briefFiles}
                onChoose={() => briefFileInput.current?.click()}
                onRemove={(index) => {
                  setBriefFiles((current) => current.filter((_, i) => i !== index));
                  uploadedSupportingFiles.current = null;
                  setCheckId(null);
                  setReport(null);
                }}
                emptyLabel="PDF, PowerPoint, Word, CSV or images"
                busy={!!busy}
              />
              <Textarea
                id="brief"
                rows={5}
                placeholder="Optional: paste the brief or add notes…"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
              />
            </div>

            <div className="mt-5 grid gap-1.5">
              <Label htmlFor="copy">Copy</Label>
              <input
                ref={copyFileInput}
                type="file"
                accept={ACCEPTED_TYPES}
                className="hidden"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length) setCopyFiles((current) => [...current, ...files]);
                  uploadedSupportingFiles.current = null;
                  e.target.value = "";
                  setCheckId(null);
                  setReport(null);
                }}
              />
              <FilePicker
                files={copyFiles}
                onChoose={() => copyFileInput.current?.click()}
                onRemove={(index) => {
                  setCopyFiles((current) => current.filter((_, i) => i !== index));
                  uploadedSupportingFiles.current = null;
                  setCheckId(null);
                  setReport(null);
                }}
                emptyLabel="PDF, PowerPoint, Word, CSV or images"
                busy={!!busy}
              />
              <Textarea
                id="copy"
                rows={4}
                className="flex-1"
                placeholder="Optional: paste a headline, body copy, CTA, or notes…"
                value={copy}
                onChange={(e) => setCopy(e.target.value)}
              />
            </div>

            <div className="mt-5">
              <Label>Creative files</Label>
              <input
                ref={fileInput}
                type="file"
                accept={ACCEPTED_TYPES}
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
              <div className="mt-1.5">
                <FilePicker
                  files={assets}
                  onChoose={() => fileInput.current?.click()}
                  onRemove={(i) => {
                    setAssets((current) => current.filter((_, j) => j !== i));
                    setCheckId(null);
                    setReport(null);
                  }}
                  emptyLabel="PDF, PowerPoint, Word, images, logos or SVG"
                  busy={!!busy}
                />
              </div>
            </div>
          </section>

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
          ) : null}

        </aside>
      </div>
    </>
  );
}

function FilePicker({
  files,
  onChoose,
  onRemove,
  emptyLabel,
  busy,
}: {
  files: File[];
  onChoose: () => void;
  onRemove: (index: number) => void;
  emptyLabel: string;
  busy: boolean;
}) {
  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={onChoose}
        className="flex min-h-[180px] w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-[1.5px] border-dashed border-brand-soft bg-card px-6 py-7 text-center transition-colors hover:bg-brand-tint/40 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="flex size-[60px] items-center justify-center rounded-full bg-brand-tint text-brand">
          <Upload aria-hidden className="size-6" strokeWidth={2} />
        </span>
        <span className="text-base leading-[22px] font-semibold">
          {files.length ? "Add more files" : "Upload files"}
        </span>
        <span className="text-[13px] text-ink-muted">
          <span className="font-semibold text-brand underline underline-offset-[3px]">browse files</span>{" "}
          · {files.length ? `${files.length} ${files.length === 1 ? "file" : "files"} selected` : emptyLabel}
        </span>
      </button>
      {files.length ? (
        <ul className="mt-2 text-sm">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center justify-between gap-3 border-t border-line-soft py-2 first:border-t-0"
            >
              <span className="truncate">{file.name}</span>
              <Button
                variant="link"
                size="sm"
                className="px-0"
                disabled={busy}
                onClick={() => onRemove(index)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
