import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { AppShell, StateBadge } from "@/components/app-shell";
import { Meter, ScoreRing } from "@/components/visuals";

import { getCheck, signedAssetUrl } from "@/lib/cobrand-client";

export const Route = createFileRoute("/reviews/$checkId")({
  head: () => ({
    meta: [
      { title: "Creative review — CoBrand" },
      {
        name: "description",
        content:
          "Scores, findings, the exact rule each finding cites and a concrete fix for every issue.",
      },
      { property: "og:title", content: "Creative review — CoBrand" },
      {
        property: "og:description",
        content: "Scores, findings, cited rules and concrete fixes for this creative.",
      },
    ],
  }),
  component: ReviewResult,
});

const DIMENSIONS: Record<string, string> = {
  recognition: "Brand recognition",
  layout: "Layout & clarity",
  messaging: "Messaging",
  channel_fit: "Channel fit",
  campaign_fit: "Campaign fit",
};

function ReviewResult() {
  const { checkId } = useParams({ from: "/reviews/$checkId" });
  const [assetUrl, setAssetUrl] = useState<string | null>(null);
  const [activePin, setActivePin] = useState<number | null>(null);

  const check = useQuery({ queryKey: ["check", checkId], queryFn: () => getCheck(checkId) });

  useEffect(() => {
    const path = check.data?.asset_path;
    if (!path) return;
    signedAssetUrl("creatives", path).then(setAssetUrl);
  }, [check.data?.asset_path]);

  const findings = useMemo(
    () => [...(check.data?.findings ?? [])].sort((a, b) => a.number - b.number),
    [check.data?.findings],
  );
  const issues = findings.filter((f) => f.status === "issue");
  const passes = findings.filter((f) => f.status !== "issue");
  const scores = (check.data?.dimension_scores ?? {}) as Record<string, number>;
  const readiness = check.data?.readiness as { score?: number; cannot_do?: string } | null;
  const isImage = (check.data?.asset_mime ?? "").startsWith("image/");

  if (check.isLoading) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Loading review…</p>
      </AppShell>
    );
  }

  if (!check.data) {
    return (
      <AppShell>
        <p>That review could not be found.</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="rise-enter mb-12 flex flex-wrap items-end justify-between gap-10">
        <div className="max-w-2xl">
          <p className="eyebrow mb-3">
            {check.data.brands?.name} · brand model v{check.data.brand_model_version}
          </p>
          <h1>{check.data.asset_name ?? "Creative review"}</h1>
          {check.data.summary ? (
            <p className="lede mt-5">{check.data.summary}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-5">
          <ScoreRing value={check.data.score ?? 0} size={104} />
          <p className="eyebrow max-w-[7rem]">{check.data.label ?? check.data.status}</p>
        </div>
      </div>

      {check.data.error ? (
        <p className="mb-6 rounded-[var(--radius)] bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {check.data.error}
        </p>
      ) : null}

      <div className="grid gap-10 border-y border-border/60 py-8 sm:grid-cols-5">
        {Object.entries(DIMENSIONS).map(([key, label]) => (
          <div key={key}>
            <p className="eyebrow">{label}</p>
            <p className="display mt-2 text-3xl leading-none">{scores[key] ?? "—"}</p>
            <div className="mt-3">
              <Meter value={scores[key] ?? 0} />
            </div>
          </div>
        ))}
      </div>


      {readiness?.cannot_do ? (
        <p className="mt-6 surface-quiet border-dashed px-4 py-3 text-sm text-muted-foreground">
          Judged with {Math.round(readiness.score ?? 0)}% brand readiness. {readiness.cannot_do}
        </p>
      ) : null}

      <div className="mt-10 grid gap-16 lg:grid-cols-[1fr_1.1fr]">
        {assetUrl && isImage ? (
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="relative overflow-hidden surface">
              <img src={assetUrl} alt={check.data.asset_name ?? "Creative"} className="w-full" />
              {issues
                .filter((f) => f.pin_x !== null && f.pin_y !== null)
                .map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setActivePin(activePin === f.number ? null : f.number)}
                    style={{ left: `${f.pin_x}%`, top: `${f.pin_y}%` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background px-2 py-0.5 text-xs font-semibold shadow ${
                      activePin === f.number
                        ? "bg-foreground text-background"
                        : "bg-[var(--signal)] text-[var(--signal-foreground)]"
                    }`}
                  >
                    {f.number}
                  </button>
                ))}
            </div>
            {activePin ? (
              <p className="mt-3 text-sm text-muted-foreground">
                {issues.find((f) => f.number === activePin)?.explanation}
              </p>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                Numbered pins mark the exact spot each finding refers to.
              </p>
            )}
          </div>
        ) : (
          <div className="surface p-6">
            <p className="eyebrow">What was reviewed</p>
            {check.data.brief_text ? (
              <>
                <p className="mt-3 text-sm font-medium">Brief</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                  {check.data.brief_text}
                </p>
              </>
            ) : null}
            {check.data.copy_text ? (
              <>
                <p className="mt-4 text-sm font-medium">Copy</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                  {check.data.copy_text}
                </p>
              </>
            ) : null}
            {check.data.asset_name && !isImage ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Asset: {check.data.asset_name}
              </p>
            ) : null}
          </div>
        )}

        <div className="space-y-4">
          <h2 className="text-2xl">
            {issues.length} {issues.length === 1 ? "issue" : "issues"} to fix
          </h2>
          {issues.map((f) => (
            <article
              key={f.id}
              className="surface p-6"
              onMouseEnter={() => setActivePin(f.number)}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--signal)] text-xs font-semibold text-[var(--signal-foreground)]">
                  {f.number}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{f.title}</h3>
                    <StateBadge
                      state={f.severity === "must" ? "missing" : "inferred"}
                      label={f.severity}
                    />
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {f.pass_name} · {f.confidence} confidence
                    </span>
                  </div>
                  <p className="mt-2 text-sm">{f.explanation}</p>
                  {f.why_it_matters ? (
                    <p className="mt-1.5 text-sm text-muted-foreground">{f.why_it_matters}</p>
                  ) : null}
                  {f.quote ? (
                    <p className="mt-2 border-l-2 border-border pl-3 text-sm italic">“{f.quote}”</p>
                  ) : null}
                  {f.suggested_fix ? (
                    <p className="mt-3 rounded bg-muted px-3 py-2 text-sm">
                      <span className="font-medium">Fix: </span>
                      {f.suggested_fix}
                    </p>
                  ) : null}
                  {f.rule_statement ? (
                    <details className="mt-3 text-sm">
                      <summary className="cursor-pointer text-muted-foreground">
                        Rule this cites
                      </summary>
                      <p className="mt-2">{f.rule_statement}</p>
                      {f.source_citation ? (
                        <p className="mt-1 text-xs text-muted-foreground">{f.source_citation}</p>
                      ) : null}
                      {f.applies_because ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Applies here because {f.applies_because}
                        </p>
                      ) : null}
                    </details>
                  ) : null}
                </div>
              </div>
            </article>
          ))}

          {passes.length > 0 ? (
            <section className="surface p-6">
              <p className="eyebrow">What already works</p>
              <ul className="mt-3 space-y-2 text-sm">
                {passes.map((f) => (
                  <li key={f.id}>
                    <span className="font-medium">{f.title}</span>{" "}
                    <span className="text-muted-foreground">{f.explanation}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <Link
            to="/brands/$brandId/review"
            params={{ brandId: check.data.brand_id }}
            className="inline-block text-sm underline underline-offset-4"
          >
            Review another creative
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
