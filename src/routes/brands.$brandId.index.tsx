import { createFileRoute, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";

import { Empty, StateBadge } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
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
  createSourceFromFile,
  createSourceFromText,
  listGaps,
  listSources,
} from "@/lib/cobrand-client";
import { ingestSource, proposeForGap, runGapCheck, addManualRule } from "@/lib/cobrand.functions";

export const Route = createFileRoute("/brands/$brandId/")({
  component: SourcesAndGaps,
});

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
  const { brandId } = useParams({ from: "/brands/$brandId/" });
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);

  const ingest = useServerFn(ingestSource);
  const gapCheck = useServerFn(runGapCheck);
  const propose = useServerFn(proposeForGap);
  const addRule = useServerFn(addManualRule);

  const [classification, setClassification] = useState<string>("auto");
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answering, setAnswering] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");

  const sources = useQuery({
    queryKey: ["sources", brandId],
    queryFn: () => listSources(brandId),
  });
  const gaps = useQuery({ queryKey: ["gaps", brandId], queryFn: () => listGaps(brandId) });

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
        const id = await createSourceFromFile(
          brandId,
          file,
          classification === "auto" ? undefined : classification,
        );
        await processSource(id, file.name);
      }
    },
    onSettled: () => setBusy(null),
    onError: (e) => setError((e as Error).message),
  });

  const paste = useMutation({
    mutationFn: async () => {
      setError(null);
      const id = await createSourceFromText(
        brandId,
        pasteTitle,
        pasteText,
        classification === "auto" ? undefined : classification,
      );
      setPasteTitle("");
      setPasteText("");
      await processSource(id, pasteTitle || "pasted notes");
    },
    onSettled: () => setBusy(null),
    onError: (e) => setError((e as Error).message),
  });

  const recheck = useMutation({
    mutationFn: async () => {
      setBusy("Checking the model for gaps…");
      await gapCheck({ data: { brandId } });
      refresh();
    },
    onSettled: () => setBusy(null),
    onError: (e) => setError((e as Error).message),
  });

  const proposeFor = useMutation({
    mutationFn: async (gapId: string) => {
      setBusy("Drafting a candidate rule…");
      const result = await propose({ data: { gapId } });
      refresh();
      if (!result.proposed) setError(result.reason);
    },
    onSettled: () => setBusy(null),
    onError: (e) => setError((e as Error).message),
  });

  const answerGap = useMutation({
    mutationFn: async (gap: { id: string; topic: string; layer: string | null }) => {
      setBusy("Saving…");
      await addRule({
        data: {
          brandId,
          gapId: gap.id,
          layer: gap.layer ?? "identity",
          ruleType: "other",
          label: gap.topic,
          statement: answer.trim(),
          value: "",
          severity: "must",
        },
      });
      setAnswering(null);
      setAnswer("");
      refresh();
    },
    onSettled: () => setBusy(null),
    onError: (e) => setError((e as Error).message),
  });

  const removeSource = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("source_files").delete().eq("id", id);
      refresh();
    },
  });

  const openGaps = (gaps.data ?? []).filter((g) => !g.resolved);

  return (
    <div className="grid gap-16 lg:grid-cols-[1.2fr_1fr]">
      <section>
        <h2 className="text-2xl">Brand materials</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Guidelines, strategy decks, campaign rules, approved work. PDF, PowerPoint, Word, images,
          SVG logos or pasted text. Up to {MAX_FILES_PER_PASS} files at a time, 25 MB each.
        </p>

        <div className="mt-5 surface p-6">
          <div className="grid gap-1.5">
            <Label>What is this material?</Label>
            <Select value={classification} onValueChange={setClassification}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Let CoBrand decide</SelectItem>
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
          <Button
            className="mt-4"
            disabled={!!busy}
            onClick={() => fileInput.current?.click()}
          >
            Upload files
          </Button>

          <div className="mt-6 border-t border-border pt-5">
            <Label htmlFor="paste-title">Or paste text</Label>
            <Input
              id="paste-title"
              className="mt-1.5"
              placeholder="Title, e.g. Tone of voice notes"
              value={pasteTitle}
              onChange={(e) => setPasteTitle(e.target.value)}
            />
            <Textarea
              className="mt-2"
              rows={4}
              placeholder="Paste guideline text, messaging, do's and don'ts…"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <Button
              variant="secondary"
              className="mt-3"
              disabled={!!busy || pasteText.trim().length < 20}
              onClick={() => paste.mutate()}
            >
              Add pasted text
            </Button>
          </div>

          {busy ? <p className="mt-4 text-sm text-muted-foreground">{busy}</p> : null}
          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
        </div>

        <div className="mt-8 space-y-4">
          {(sources.data ?? []).length === 0 ? (
            <Empty
              title="No materials yet"
              body="CoBrand cannot invent brand truth. Everything it knows comes from what you upload here."
            />
          ) : (
            (sources.data ?? []).map((source) => (
              <div key={source.id} className="surface p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{source.file_name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {source.classification ?? "Unclassified"} · {source.status}
                      {source.status === "done" ? ` · ${source.rules_extracted} rules` : ""}
                    </p>
                    {source.classification_rationale ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {source.classification_rationale}
                      </p>
                    ) : null}
                    {source.error ? (
                      <p className="mt-2 text-xs text-destructive">{source.error}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {source.status !== "done" ? (
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
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl">Setup gaps</h2>
          <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => recheck.mutate()}>
            Re-check
          </Button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          What the brand model is missing or too vague about. These stay visible until they are
          answered — CoBrand will not guess.
        </p>

        <div className="mt-7 space-y-4">
          {openGaps.length === 0 ? (
            <Empty
              title="Nothing outstanding"
              body="Once materials are ingested, anything missing or vague appears here."
            />
          ) : (
            openGaps.map((gap) => (
              <div key={gap.id} className="surface p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{gap.topic}</p>
                  <StateBadge state={gap.gap_type} />
                </div>
                {gap.why_it_matters ? (
                  <p className="mt-1.5 text-sm text-muted-foreground">{gap.why_it_matters}</p>
                ) : null}
                {gap.source_note ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">{gap.source_note}</p>
                ) : null}

                {answering === gap.id ? (
                  <div className="mt-3">
                    <Textarea
                      rows={3}
                      autoFocus
                      placeholder="Write the answer in your own words…"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                    />
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        disabled={!!busy || answer.trim().length < 3}
                        onClick={() => answerGap.mutate(gap)}
                      >
                        Save as brand truth
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setAnswering(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setAnswering(gap.id);
                        setAnswer("");
                      }}
                    >
                      Answer it
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!!busy}
                      onClick={() => proposeFor.mutate(gap.id)}
                    >
                      Let CoBrand propose
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
