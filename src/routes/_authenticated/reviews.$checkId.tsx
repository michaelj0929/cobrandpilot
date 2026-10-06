import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { Check, ChevronDown, Info, TriangleAlert, X } from "lucide-react";

import { AppShell, StateBadge } from "@/components/app-shell";
import { BusyLine } from "@/components/loading";
import { Button } from "@/components/ui/button";
import { BRAND_KIND_LABEL, getCheck, listBrands, signedAssetUrl } from "@/lib/cobrand-client";
import { averageScores, reviewVerdict, type ReviewVerdictKey } from "@/lib/review-status";

export const Route = createFileRoute("/_authenticated/reviews/$checkId")({
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReviewResult,
});

function VerdictPill({
  verdict,
  className = "",
}: {
  verdict: { label: string; icon: ReviewVerdictKey; className: string };
  className?: string;
}) {
  const Icon = verdict.icon === "pass" ? Check : verdict.icon === "revise" ? TriangleAlert : X;
  return (
    <span
      className={`inline-flex min-h-7 w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-semibold ${verdict.className} ${className}`}
    >
      <Icon aria-hidden className="size-3.5 shrink-0" />
      {verdict.label}
    </span>
  );
}


function ReviewResult() {
  const { checkId } = useParams({ from: "/_authenticated/reviews/$checkId" });
  const [assetUrl, setAssetUrl] = useState<string | null>(null);
  const [activePin, setActivePin] = useState<number | null>(null);

  const check = useQuery({ queryKey: ["check", checkId], queryFn: () => getCheck(checkId) });
  const brands = useQuery({ queryKey: ["brands"], queryFn: () => listBrands() });
  // sub_brand_ids comes from migration 20261002230000; cast until types regenerate.
  const subBrandIds =
    (check.data as { sub_brand_ids?: string[] | null } | null | undefined)?.sub_brand_ids ?? [];
  const checkedSubBrands = (brands.data ?? []).filter((b) => subBrandIds.includes(b.id));

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
        <BusyLine text="Loading review…" />
      </AppShell>
    );
  }

  if (!check.data) {
    return (
      <AppShell>
        <h1>That review could not be found.</h1>
      </AppShell>
    );
  }

  const reviewedBrandId = check.data.brand_id;
  const overallVerdict = reviewVerdict(check.data.score);
  const dimensions = [
    {
      label: "Brand Compliant",
      verdict: reviewVerdict(
        averageScores(scores["recognition"], scores["channel_fit"], scores["campaign_fit"]),
      ),
    },
    { label: "Copy", verdict: reviewVerdict(scores["messaging"]) },
    { label: "Layout", verdict: reviewVerdict(scores["layout"]) },
  ];

  return (
    <AppShell
      brand={{
        id: reviewedBrandId,
        name: check.data.brands?.name ?? null,
        version: check.data.brands?.current_version ?? null,
        workspaceId: (brands.data ?? []).find((brand) => brand.id === reviewedBrandId)?.workspace_id ?? null,
      }}
    >
      <div className="rise-enter mb-7 flex flex-wrap items-end justify-between gap-6">
        <div className="flex max-w-[600px] flex-col gap-2.5">
          <p className="eyebrow">
            {check.data.brands?.name} · brand model v{check.data.brand_model_version}
          </p>
          <h1>{check.data.asset_name ?? "Creative review"}</h1>
          {check.data.summary ? <p className="lede">{check.data.summary}</p> : null}
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
            Checked against
            <span className="inline-flex h-6 items-center rounded-full bg-brand-tint px-2.5 font-semibold text-brand">
              {check.data.brands?.name ?? "Master brand"}
            </span>
            {checkedSubBrands.map((sub) => (
              <span
                key={sub.id}
                className="inline-flex h-6 items-center rounded-full bg-card px-2.5 font-semibold text-ink ring-1 ring-line-soft"
              >
                {sub.name} · {BRAND_KIND_LABEL[sub.kind].toLowerCase()}
              </span>
            ))}
          </p>
        </div>
        <section className={`max-w-sm rounded-md border px-5 py-4 ${overallVerdict.className}`}>
          <p className="text-xs font-semibold uppercase">Overall result</p>
          <h2 className="mt-1 text-lg leading-6">{overallVerdict.label}</h2>
          <p className="mt-1 text-xs leading-5 opacity-80">{overallVerdict.description}</p>
        </section>
      </div>

      {check.data.error ? (
        <p className="mb-5 rounded-md bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {check.data.error}
        </p>
      ) : null}

      <section className="surface grid gap-px overflow-hidden bg-line-soft sm:grid-cols-3">
        {dimensions.map(({ label, verdict }) => (
          <div key={label} className="flex min-h-28 flex-col justify-between bg-card px-6 py-5">
            <h2 className="text-[13px] leading-[18px] text-ink-muted">{label}</h2>
            <p className="mt-4 flex items-center gap-2 text-sm font-semibold">
              <span className={`size-2 shrink-0 rounded-full ${verdict.dotClassName}`} aria-hidden />
              {verdict.label}
            </p>
          </div>
        ))}
      </section>

      {readiness?.cannot_do ? (
        <p className="mt-5 flex items-start gap-3 rounded-lg bg-sky-tint px-4 py-3 text-sm">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
          <span>
            Judged with {Math.round(readiness.score ?? 0)}% brand readiness. {readiness.cannot_do}
          </span>
        </p>
      ) : null}

      <div className="mt-7 grid items-start gap-6 lg:grid-cols-[1fr_1.1fr]">
        {assetUrl && isImage ? (
          <div className="lg:sticky lg:top-8">
            <div className="surface relative overflow-hidden">
              <img src={assetUrl} alt={check.data.asset_name ?? "Creative"} className="w-full" />
              {issues
                .filter((f) => f.pin_x !== null && f.pin_y !== null)
                .map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setActivePin(activePin === f.number ? null : f.number)}
                    style={{ left: `${f.pin_x}%`, top: `${f.pin_y}%` }}
                    aria-label={`Finding ${f.number}`}
                    className={`absolute flex size-7 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-2 border-card text-xs font-semibold shadow-md ${
                      activePin === f.number ? "bg-brand text-on-brand" : "bg-attention text-ink"
                    }`}
                  >
                    {f.number}
                  </button>
                ))}
            </div>
            {activePin ? (
              <p className="mt-3 text-sm">
                {issues.find((f) => f.number === activePin)?.explanation}
              </p>
            ) : (
              <p className="mt-3 text-xs text-ink-muted">
                Numbered pins mark the exact spot each finding refers to.
              </p>
            )}
          </div>
        ) : (
          <section className="surface px-6 py-[22px]">
            <h2 className="text-[13px] leading-[18px] tracking-[0.2px]">What was reviewed</h2>
            {check.data.brief_text ? (
              <>
                <p className="mt-4 text-sm font-semibold">Brief</p>
                <p className="mt-1 text-sm whitespace-pre-wrap">{check.data.brief_text}</p>
              </>
            ) : null}
            {check.data.copy_text ? (
              <>
                <p className="mt-4 text-sm font-semibold">Copy</p>
                <p className="mt-1 text-sm whitespace-pre-wrap">{check.data.copy_text}</p>
              </>
            ) : null}
            {check.data.asset_name && !isImage ? (
              <p className="mt-4 text-sm text-ink-muted">Asset: {check.data.asset_name}</p>
            ) : null}
          </section>
        )}

        <div className="flex flex-col gap-4">
          {passes.length > 0 ? (
            <section className="rounded-lg bg-green-tint px-5 py-4">
              <h2 className="text-[13px] leading-[18px] tracking-[0.2px] text-green">
                What already works
              </h2>
              <ul className="mt-2 space-y-2 text-sm">
                {passes.map((f) => (
                  <li key={f.id}>
                    <span className="font-semibold">{f.title}</span> <span>{f.explanation}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <h2 className="mt-1">
            {issues.length} {issues.length === 1 ? "issue" : "issues"} to fix
          </h2>
          {issues.map((f) => (
            <details
              key={f.id}
              className="surface group px-6 py-5"
              onMouseEnter={() => setActivePin(f.number)}
            >
              <summary className="flex cursor-pointer list-none items-start gap-3 marker:content-none">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-attention text-xs font-semibold text-ink">
                  {f.number}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm leading-5">{f.title}</h3>
                    <StateBadge
                      state={f.severity === "must" ? "missing" : "inferred"}
                      label={f.severity}
                    />
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    {f.pass_name} · {f.confidence} confidence
                  </p>
                </div>
                <span className="mt-1 text-lg leading-none text-ink-muted transition-transform group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <div className="ml-10 mt-4 border-t border-line-soft pt-4">
                  <h4 className="text-xs font-semibold uppercase text-ink-muted">What was flagged</h4>
                  <p className="mt-2.5 text-sm">{f.explanation}</p>
                  {f.why_it_matters ? (
                    <p className="mt-1.5 text-sm text-ink-muted">{f.why_it_matters}</p>
                  ) : null}
                  {f.quote ? (
                    <p className="mt-3 rounded-md bg-page px-3.5 py-2.5 text-sm italic">
                      “{f.quote}”
                    </p>
                  ) : null}
                  {f.suggested_fix ? (
                    <p className="mt-3 rounded-md bg-brand-tint px-3.5 py-2.5 text-sm">
                      <span className="font-semibold text-brand">Fix: </span>
                      {f.suggested_fix}
                    </p>
                  ) : null}
                  {f.rule_statement ? (
                    <div className="mt-3 border-t border-line-soft pt-3 text-sm">
                      <p className="font-semibold text-brand">
                        Brand guideline cited{f.rule_code ? ` · ${f.rule_code}` : ""}
                      </p>
                      <p className="mt-2">{f.rule_statement}</p>
                      {f.source_citation ? (
                        <p className="mt-1 text-xs text-ink-muted">{f.source_citation}</p>
                      ) : null}
                      {f.applies_because ? (
                        <p className="mt-1 text-xs text-ink-muted">
                          Applies here because {f.applies_because}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
              </div>
            </details>
          ))}

          <Button asChild variant="secondary" className="self-start">
            <Link to="/brands/$brandId/review" params={{ brandId: check.data.brand_id }}>
              Review another creative
            </Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
