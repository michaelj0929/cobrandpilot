import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { MAX_FILE_BYTES, listChecks, uploadToBucket } from "@/lib/cobrand-client";
import { readBrief } from "@/lib/cobrand.functions";
import { checkReadiness, runReview } from "@/lib/review.functions";

export const Route = createFileRoute("/brands/$brandId/review")({
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
  const { brandId } = useParams({ from: "/brands/$brandId/review" });
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

  const createCheck = async () => {
    let assetPath: string | null = null;
    if (asset) {
      if (asset.size > MAX_FILE_BYTES) throw new Error("That file is larger than 25 MB.");
      setBusy("Uploading the creative…");
      assetPath = await uploadToBucket("creatives", brandId, asset);
    }
    const inputType = asset ? (copy.trim() ? "asset+copy" : "asset") : copy.trim() ? "copy" : "brief";
    const { data, error: insertError } = await supabase
      .from("validation_checks")
      .insert({
        brand_id: brandId,
        input_type: inputType,
        brief_text: brief.trim() || null,
        copy_text: copy.trim() || null,
        asset_path: assetPath,
        asset_name: asset?.name ?? null,
        asset_mime: asset?.type ?? null,
        creative_context: { ...context, ...(keyMessage ? { key_message: keyMessage } : {}) },
        status: "draft",
      })
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

  return (
    <div className="grid gap-10 lg:grid-cols-[1.25fr_1fr]">
      <div className="space-y-6">
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-2xl">What are you reviewing?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
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
              variant="ghost"
              size="sm"
              className="justify-self-start"
              disabled={!!busy || brief.trim().length < 20}
              onClick={() => readTheBrief.mutate()}
            >
              Pull the context out of this brief
            </Button>
          </div>

          <div className="mt-4 grid gap-1.5">
            <Label htmlFor="copy">Copy</Label>
            <Textarea
              id="copy"
              rows={4}
              placeholder="Headline, body, CTA…"
              value={copy}
              onChange={(e) => setCopy(e.target.value)}
            />
          </div>

          <div className="mt-4">
            <Label>Visual asset</Label>
            <input
              ref={fileInput}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.svg,.pdf"
              className="hidden"
              onChange={(e) => setAsset(e.target.files?.[0] ?? null)}
            />
            <div className="mt-1.5 flex items-center gap-3">
              <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()}>
                Choose file
              </Button>
              <span className="text-sm text-muted-foreground">
                {asset ? asset.name : "PNG, JPG, WEBP, SVG or PDF"}
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-2xl">Context</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Optional, but it decides which rules apply. Leave anything you don't know blank.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      <aside className="space-y-6">
        {report ? (
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="eyebrow">Brand readiness for this review</p>
            <p className="display mt-2 text-4xl">{Math.round(report.score)}%</p>
            <p className="mt-2 text-sm">{report.can_do}</p>
            {report.cannot_do ? (
              <p className="mt-2 text-sm text-muted-foreground">{report.cannot_do}</p>
            ) : null}
            {report.missing?.length ? (
              <div className="mt-4">
                <p className="eyebrow">Missing for this review</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {report.missing.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {report.available?.length ? (
              <div className="mt-4">
                <p className="eyebrow">Available</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {report.available.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-card/50 p-5 text-sm text-muted-foreground">
            CoBrand can tell you what it is able to judge before it reviews anything — useful when
            the brand model is still thin.
          </div>
        )}

        <div className="rounded-lg border border-border bg-card p-5">
          <p className="eyebrow">Past reviews</p>
          <ul className="mt-3 space-y-3 text-sm">
            {(history.data ?? []).slice(0, 8).map((check) => (
              <li key={check.id}>
                <a
                  href={`/reviews/${check.id}`}
                  className="flex items-center justify-between gap-3 hover:underline"
                >
                  <span className="truncate">
                    {check.asset_name ?? check.label ?? check.input_type}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {check.score === null ? check.status : check.score}
                  </span>
                </a>
              </li>
            ))}
            {(history.data ?? []).length === 0 ? (
              <li className="text-xs text-muted-foreground">Nothing reviewed yet.</li>
            ) : null}
          </ul>
        </div>
      </aside>
    </div>
  );
}
