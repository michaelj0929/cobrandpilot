import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";

import { Hammer, Upload } from "lucide-react";

import { Empty, PageHead } from "@/components/app-shell";
import { BusyLine, LoadingPanel, StepList, type Step } from "@/components/loading";
import { SubBrandsPanel } from "@/components/sub-brands";
import { BrandScopePicker } from "@/components/brand-scope";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  ACCEPTED_TYPES,
  MAX_FILES_PER_PASS,
  MAX_FILE_BYTES,
  BRAND_KIND_LABEL,
  createSourceFromFile,
  createSourceFromText,
  deleteSource,
  getBrand,
  listGaps,
  listSources,
  replaceSource,
} from "@/lib/cobrand-client";
import { ingestSource, runGapCheck } from "@/lib/cobrand.functions";

export const Route = createFileRoute("/_authenticated/brands/$brandId/")({
  component: SourcesAndGaps,
});

type SourceRow = Awaited<ReturnType<typeof listSources>>[number];


const CLASSIFICATIONS = [
  "Master Brand Guideline",
  "Messaging/Strategy",
  "Campaign Guideline",
  "Approved Creatives",
  "Design System/UI",
  "Product Messaging",
  "Channel Guidelines",
  "Other",
];

function SourcesAndGaps() {
  const { brandId } = useParams({ from: "/_authenticated/brands/$brandId/" });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);

  const ingest = useServerFn(ingestSource);
  const gapCheck = useServerFn(runGapCheck);

  const [classification, setClassification] = useState<string>("");
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sources = useQuery({
    queryKey: ["sources", brandId],
    queryFn: () => listSources(brandId),
  });
  const gaps = useQuery({ queryKey: ["gaps", brandId], queryFn: () => listGaps(brandId) });
  const brand = useQuery({ queryKey: ["brand", brandId], queryFn: () => getBrand(brandId) });
  const parentId = brand.data?.parent_brand_id ?? null;
  const master = useQuery({
    queryKey: ["brand", parentId],
    queryFn: () => getBrand(parentId ?? ""),
    enabled: parentId !== null,
  });
  const isSub = parentId !== null;
  const [build, setBuild] = useState<{ files: string[]; done: number; gaps: boolean } | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["sources", brandId] });
    queryClient.invalidateQueries({ queryKey: ["gaps", brandId] });
    queryClient.invalidateQueries({ queryKey: ["rules", brandId] });
    queryClient.invalidateQueries({ queryKey: ["brand", brandId] });
  };

  async function processSource(sourceFileId: string, label: string) {
    setBusy(`Reading ${label}…`);
    await ingest({ data: { sourceFileId } });
    queryClient.invalidateQueries({ queryKey: ["sources", brandId] });
    setBusy("Checking the model for gaps…");
    await gapCheck({ data: { brandId } });
    refresh();
  }

  const upload = useMutation({
    mutationFn: async (files: FileList) => {
      setError(null);
      const list = Array.from(files).slice(0, MAX_FILES_PER_PASS);
      const tooBig = list.find((f) => f.size > MAX_FILE_BYTES);
      if (tooBig) throw new Error(`${tooBig.name} is larger than 25 MB.`);
      for (const file of list) {
        setBusy(`Uploading ${file.name}…`);
        await createSourceFromFile(
          brandId,
          file,
          classification || undefined,
        );
      }
      queryClient.invalidateQueries({ queryKey: ["sources", brandId] });
    },
    onSettled: () => setBusy(null),
    onError: (e) => setError((e as Error).message),
  });

  const paste = useMutation({
    mutationFn: async () => {
      setError(null);
      setBusy("Adding pasted text…");
      await createSourceFromText(
        brandId,
        pasteTitle,
        pasteText,
        classification || undefined,
      );
      setPasteTitle("");
      setPasteText("");
      queryClient.invalidateQueries({ queryKey: ["sources", brandId] });
    },
    onSettled: () => setBusy(null),
    onError: (e) => setError((e as Error).message),
  });

  // Everything uploaded but not yet read into the brand system.
  const pending = (sources.data ?? []).filter((s) =>
    ["queued", "pending", "failed"].includes(s.status),
  );

  // Build: read every pending document in turn, then run one gap check.
  const buildSystem = useMutation({
    mutationFn: async () => {
      setError(null);
      const queue = pending.map((s) => ({ id: s.id, name: s.file_name }));
      const failed: string[] = [];
      setBuild({ files: queue.map((q) => q.name), done: 0, gaps: false });
      for (const [i, item] of queue.entries()) {
        setBusy(`Reading ${item.name}…`);
        try {
          await ingest({ data: { sourceFileId: item.id } });
        } catch {
          failed.push(item.name);
        }
        setBuild((b) => (b ? { ...b, done: i + 1 } : b));
        queryClient.invalidateQueries({ queryKey: ["sources", brandId] });
      }
      setBusy("Checking the model for gaps…");
      setBuild((b) => (b ? { ...b, gaps: true } : b));
      await gapCheck({ data: { brandId } });
      refresh();
      if (failed.length > 0) {
        throw new Error(
          `${failed.join(", ")} could not be read. Retry ${failed.length === 1 ? "it" : "them"} below.`,
        );
      }
    },
    onSuccess: () => navigate({ to: "/brands/$brandId/brain", params: { brandId } }),
    onSettled: () => {
      setBusy(null);
      setBuild(null);
    },
    onError: (e) => setError((e as Error).message),
  });


  const removeSource = useMutation({
    mutationFn: async (source: SourceRow) => {
      await deleteSource(source);
      refresh();
    },
  });

  // Replace: swap one material for a new file, keep its document type, and
  // read the new file straight into the brand system.
  const replacing = useRef<SourceRow | null>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replaceSourceMutation = useMutation({
    mutationFn: async (file: File) => {
      const old = replacing.current;
      if (!old) return;
      if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is larger than 25 MB.`);
      setError(null);
      setBusy(`Replacing ${old.file_name}…`);
      const newId = await replaceSource(brandId, old, file);
      await processSource(newId, file.name);
    },
    onSettled: () => setBusy(null),
    onError: (e) => setError((e as Error).message),
  });



  // Real progress of the build: one step per document, then the gap check.
  const buildSteps: Step[] = build
    ? [
        ...build.files.map((name, i): Step => ({
          label: `Reading ${name}`,
          state: i < build.done ? "done" : i === build.done ? "live" : "waiting",
        })),
        ...(isSub
          ? []
          : [
              {
                label: "Checking for gaps",
                state: build.gaps ? ("live" as const) : ("waiting" as const),
              },
            ]),
      ]
    : [];
  const buildPct = build ? Math.round((build.done / Math.max(build.files.length, 1)) * 100) : 0;
  const hasRules = (sources.data ?? []).some((s) => s.status === "done");
  const masterName = master.data?.name ?? "the master brand";

  return (
    <>
      <PageHead
        {...(brand.data ? { eyebrow: BRAND_KIND_LABEL[brand.data.kind] } : {})}
        title={isSub ? `Upload ${brand.data?.name ?? ""} guidelines` : "Upload your brand"}
        description={
          isSub
            ? `Upload the guidelines that only apply to ${brand.data?.name ?? "this sub-brand"}. They add to the ${masterName} brand system and are checked against it for conflicts.`
            : `Upload everything that defines your brand: guidelines, strategy decks, campaign rules, approved work. When it's all in, build your brand system. PDF, PowerPoint, Word, images, SVG logos or pasted text, up to ${MAX_FILES_PER_PASS} files at a time, 25 MB each.`
        }
      />

      <BrandScopePicker brandId={brandId} to="/brands/$brandId" label="Uploading to" />

      <div className="grid items-start gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="flex flex-col gap-5">
          <div className="surface flex flex-col gap-5 px-6 py-[22px]">
            <div className="grid max-w-sm gap-1.5">
              <Label>Choose the document type that best fits</Label>
              <Select value={classification} onValueChange={setClassification}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a document type" />
                </SelectTrigger>
                <SelectContent>
                  {CLASSIFICATIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <input
              ref={fileInput}
              type="file"
              multiple
              accept={ACCEPTED_TYPES}
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) upload.mutate(e.target.files);
                e.target.value = "";
              }}
            />
            <input
              ref={replaceInput}
              type="file"
              accept={ACCEPTED_TYPES}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) replaceSourceMutation.mutate(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={!!busy}
              onClick={() => fileInput.current?.click()}
              className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-[1.5px] border-dashed border-brand-soft bg-card px-6 py-8 text-center transition-colors hover:bg-brand-tint/40 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex size-[68px] items-center justify-center rounded-full bg-brand-tint text-brand">
                <Upload aria-hidden className="size-7" strokeWidth={2} />
              </span>
              <span className="text-base leading-[22px] font-semibold">Upload files</span>
              <span className="text-[13px] text-ink-muted">
                <span className="font-semibold text-brand underline underline-offset-[3px]">
                  browse files
                </span>{" "}
                · PDF, PowerPoint, Word, images or SVG
              </span>
            </button>

            <div className="flex flex-col gap-1.5 border-t border-line-soft pt-5">
              <Label htmlFor="paste-title">Or paste text</Label>
              <Input
                id="paste-title"
                placeholder="Title, e.g. Tone of voice notes"
                value={pasteTitle}
                onChange={(e) => setPasteTitle(e.target.value)}
              />
              <Textarea
                className="mt-1"
                rows={4}
                placeholder="Paste guideline text, messaging, do's and don'ts…"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
              />
              <Button
                variant="secondary"
                className="mt-2 self-start"
                disabled={!!busy || pasteText.trim().length < 20}
                onClick={() => paste.mutate()}
              >
                Add pasted text
              </Button>
            </div>

            {busy && !buildSystem.isPending ? <BusyLine text={busy} /> : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          {(sources.data ?? []).length === 0 ? (
            <Empty
              title="No materials yet"
              body="CoBrand cannot invent brand truth. Everything it knows comes from what you upload here."
            />
          ) : (
            <div className="surface px-6 py-[22px]">
              <h2 className="text-[13px] leading-[18px] tracking-[0.2px]">Uploaded materials</h2>
              <ul className="mt-1.5">
                {(sources.data ?? []).map((source) => (
                  <li
                    key={source.id}
                    className="flex items-start justify-between gap-3 border-t border-line-soft py-3.5 first:border-t-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{source.file_name}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                        <SourceStatus status={source.status} />
                        <span>{source.classification ?? "Unclassified"}</span>
                        {source.status === "done" ? (
                          <span>· {source.rules_extracted} rules</span>
                        ) : null}
                      </p>
                      {source.classification_rationale ? (
                        <p className="mt-2 text-xs text-ink-muted">
                          {source.classification_rationale}
                        </p>
                      ) : null}
                      {source.error ? (
                        <p className="mt-2 text-xs text-destructive">{source.error}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {source.status === "failed" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!!busy}
                          onClick={() => {
                            setBusy(`Reading ${source.file_name}…`);
                            processSource(source.id, source.file_name)
                              .catch((e) => setError((e as Error).message))
                              .finally(() => setBusy(null));
                          }}
                        >
                          Retry
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeSource.mutate(source.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-5">
          {build ? (
            <LoadingPanel
              title={isSub ? "Adding to your brand system" : "Building your brand system"}
            >
              <div className="flex flex-col gap-4">
                <Progress value={buildPct} label={`${buildPct}% complete`} />
                <StepList steps={buildSteps} />
              </div>
            </LoadingPanel>
          ) : pending.length > 0 ? (
            <section className="flex flex-col gap-3 rounded-lg bg-brand-tint px-6 py-[22px]">
              <h2>
                {pending.length} {pending.length === 1 ? "document" : "documents"} ready
              </h2>
              <p className="text-sm">
                {hasRules
                  ? "Add them to the brand system when you're ready."
                  : "Upload everything first, then build. CoBrand reads each document and organizes it into your brand system."}
              </p>
              <Button className="self-start" disabled={!!busy} onClick={() => buildSystem.mutate()}>
                <Hammer aria-hidden />
                {isSub
                  ? `Build ${brand.data?.name ?? ""} guidelines`
                  : hasRules
                    ? "Update brand system"
                    : "Build brand system"}
              </Button>
            </section>
          ) : null}

          {isSub ? (
            <section className="rounded-lg bg-sky-tint px-6 py-[22px]">
              <h2>Built on {masterName}</h2>
              <p className="mt-1.5 text-sm">
                Anything here that contradicts a confirmed {masterName} rule is flagged in its
                Brand System.
              </p>
            </section>
          ) : null}
        </section>
      </div>

      {!isSub && brand.data ? (
        <div className="mt-10">
          <SubBrandsPanel master={brand.data} />
        </div>
      ) : null}
    </>
  );
}

function SourceStatus({ status }: { status: string }) {
  const tone =
    status === "done"
      ? "bg-green-tint text-green"
      : status === "failed"
        ? "bg-[var(--missing)]/10 text-[var(--missing)]"
        : "bg-attention text-ink";
  return (
    <span
      className={`inline-flex h-5 items-center rounded-full px-2 text-[11px] font-semibold ${tone}`}
    >
      {status}
    </span>
  );
}
