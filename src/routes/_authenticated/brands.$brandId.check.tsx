import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, CircleAlert, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { PageHead } from "@/components/app-shell";
import { BrandScopePicker } from "@/components/brand-scope";
import { BusyLine } from "@/components/loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  LAYERS,
  LAYER_CATEGORIES,
  LAYER_LABEL,
  LAYER_QUESTION,
  categoryLabel,
  getBrand,
  listGaps,
  listRules,
  ruleValue,
  type BrandRule,
} from "@/lib/cobrand-client";
import {
  addManualRule,
  confirmRule,
  proposeForCategory,
  proposeForGap,
  runGapCheck,
  saveRule,
} from "@/lib/cobrand.functions";

export const Route = createFileRoute("/_authenticated/brands/$brandId/check")({
  head: () => ({
    meta: [
      { title: "Brand Check — CoBrand" },
      { name: "description", content: "See what your brand system has, what was inferred, and what is missing." },
      { property: "og:title", content: "Brand Check — CoBrand" },
      { property: "og:description", content: "Complete, inferred and missing brand rules at a glance." },
    ],
  }),
  component: BrandCheck,
});

type Layer = (typeof LAYERS)[number];
type Item = {
  key: string;
  layer: Layer;
  category: string | null;
  title: string;
  status: "complete" | "inferred" | "missing" | "inherited";
  rules: BrandRule[];
  gap?: { id: string; topic: string; layer: string | null; gap_type: string; source_note: string | null; why_it_matters: string | null };
};

function sourceOf(r: BrandRule) {
  if (r.source_document) return `${r.source_document}${r.source_page ? `, p.${r.source_page}` : ""}`;
  return r.source_citation ?? "";
}

function BrandCheck() {
  const { brandId } = useParams({ from: "/_authenticated/brands/$brandId/check" });
  const queryClient = useQueryClient();
  const [layer, setLayer] = useState<Layer>("intent");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const brand = useQuery({ queryKey: ["brand", brandId], queryFn: () => getBrand(brandId) });
  const rules = useQuery({ queryKey: ["rules", brandId], queryFn: () => listRules(brandId) });
  const gaps = useQuery({ queryKey: ["gaps", brandId], queryFn: () => listGaps(brandId) });
  const isSub = !!brand.data?.parent_brand_id;

  const gapCheck = useServerFn(runGapCheck);
  const refresh = () => {
    for (const k of ["rules", "gaps", "versions", "brand"]) queryClient.invalidateQueries({ queryKey: [k, brandId] });
  };

  const items = useMemo(() => {
    const live = (rules.data ?? []).filter((r) => r.status !== "archived");
    const out: Item[] = [];
    for (const l of LAYERS) {
      for (const cat of LAYER_CATEGORIES[l]) {
        const rs = live.filter((r) => (r.category ?? r.rule_type) === cat);
        const status: Item["status"] = rs.some((r) => r.status === "confirmed")
          ? "complete"
          : rs.length
            ? "inferred"
            : isSub
              ? "inherited"
              : "missing";
        out.push({ key: `${l}-${cat}`, layer: l, category: cat, title: categoryLabel(cat), status, rules: rs });
      }
    }
    for (const g of (gaps.data ?? []).filter((g) => !g.resolved)) {
      const l = (LAYERS as readonly string[]).includes(g.layer ?? "") ? (g.layer as Layer) : "execution";
      out.push({ key: `gap-${g.id}`, layer: l, category: null, title: g.topic, status: "missing", rules: [], gap: g });
    }
    return out;
  }, [rules.data, gaps.data, isSub]);

  const counts = {
    complete: items.filter((i) => i.status === "complete").length,
    inferred: items.filter((i) => i.status === "inferred").length,
    missing: items.filter((i) => i.status === "missing").length,
  };
  const total = counts.complete + counts.inferred + counts.missing;
  const pct = total ? Math.round((counts.complete / total) * 100) : 0;

  const recheck = useMutation({
    mutationFn: async () => {
      setError(null);
      setBusy("Checking the brand system for gaps…");
      await gapCheck({ data: { brandId } });
      refresh();
    },
    onSettled: () => setBusy(null),
    onError: (e) => setError((e as Error).message),
  });

  const shared = { brandId, busy, setBusy, setError, refresh };

  return (
    <>
      <Link
        to="/brands/$brandId/brain"
        params={{ brandId }}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" /> Back to Brand System
      </Link>
      <PageHead
        eyebrow="Brand Check"
        title={brand.data?.name ?? "Brand Check"}
        description={
          isSub
            ? "What this sub-brand adds on top of the master brand. Anything it doesn't define uses the master brand."
            : "Everything your brand system needs to check creative against: what's confirmed, what CoBrand inferred, and what's missing."
        }
        actions={
          <Button variant="secondary" disabled={!!busy} onClick={() => recheck.mutate()}>
            Re-check
          </Button>
        }
      />
      <BrandScopePicker brandId={brandId} to="/brands/$brandId/check" label="Brand" />

      <div className="surface mb-8 px-6 py-5">
        <p className="text-sm">
          <span className="font-semibold text-green">{counts.complete} complete</span>
          <span className="text-ink-muted"> · </span>
          <span className="font-semibold">{counts.inferred} inferred</span>
          <span className="text-ink-muted"> · </span>
          <span className="font-semibold text-[var(--missing)]">{counts.missing} missing</span>
        </p>
        <Progress className="mt-3" value={pct} label={`${pct}% complete`} />
        {busy ? <div className="mt-3"><BusyLine text={busy} /></div> : null}
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </div>

      {counts.missing > 0 ? (
        <section className="mb-10">
          <h2 className="mb-3">Missing</h2>
          <ul className="flex flex-col gap-2">
            {items
              .filter((i) => i.status === "missing")
              .map((i) => (
                <ItemRow key={`top-${i.key}`} item={i} showLayer {...shared} />
              ))}
          </ul>
        </section>
      ) : null}

      <div role="tablist" aria-label="Brand layers" className="mb-5 grid gap-3 sm:grid-cols-3">
        {LAYERS.map((l) => {
          const missing = items.filter((i) => i.layer === l && i.status === "missing").length;
          return (
            <button
              key={l}
              role="tab"
              aria-selected={layer === l}
              onClick={() => setLayer(l)}
              className={`cursor-pointer rounded-lg border px-5 py-4 text-left transition-colors ${
                layer === l ? "border-foreground bg-foreground text-background" : "border-line-soft bg-card hover:bg-brand-tint/40"
              }`}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-base font-semibold">{LAYER_LABEL[l]}</span>
                <span className="text-xs opacity-70">{missing} missing</span>
              </span>
              <span className="mt-1 block text-[13px] opacity-75">{LAYER_QUESTION[l]}</span>
            </button>
          );
        })}
      </div>

      <ul key={layer} className="view-enter flex flex-col gap-2">
        {items
          .filter((i) => i.layer === layer)
          .map((i) => (
            <ItemRow key={i.key} item={i} {...shared} />
          ))}
      </ul>
    </>
  );
}

function ItemRow({
  item,
  showLayer,
  brandId,
  busy,
  setBusy,
  setError,
  refresh,
}: {
  item: Item;
  showLayer?: boolean;
  brandId: string;
  busy: string | null;
  setBusy: (v: string | null) => void;
  setError: (v: string | null) => void;
  refresh: () => void;
}) {
  const [mode, setMode] = useState<"idle" | "define" | "edit">("idle");
  const [statement, setStatement] = useState("");
  const [value, setValue] = useState("");
  const [severity, setSeverity] = useState("must");

  const addRule = useServerFn(addManualRule);
  const proposeGap = useServerFn(proposeForGap);
  const proposeCat = useServerFn(proposeForCategory);
  const confirm = useServerFn(confirmRule);
  const save = useServerFn(saveRule);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setError(null);
    setBusy(label);
    try {
      await fn();
      refresh();
      setMode("idle");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const first = item.rules[0];
  const icon =
    item.status === "complete" ? (
      <span className="flex size-7 items-center justify-center rounded-full bg-green-tint text-green"><Check className="size-4" aria-hidden /></span>
    ) : item.status === "inferred" ? (
      <span className="flex size-7 items-center justify-center rounded-full bg-attention text-ink"><Sparkles className="size-4" aria-hidden /></span>
    ) : item.status === "missing" ? (
      <span className="flex size-7 items-center justify-center rounded-full bg-[var(--missing)]/10 text-[var(--missing)]"><CircleAlert className="size-4" aria-hidden /></span>
    ) : (
      <span className="flex size-7 items-center justify-center rounded-full bg-page text-ink-muted">–</span>
    );

  const statusText = {
    complete: "Complete from source",
    inferred: "Inferred",
    missing: item.gap?.gap_type === "vague" ? "Too vague to check against" : "Missing",
    inherited: "Uses master brand",
  }[item.status];

  return (
    <li className="surface px-5 py-4">
      <div className="flex items-start gap-3">
        {icon}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <p className="text-sm font-semibold">
              {item.title}
              {item.status === "missing" && !item.gap ? " not found" : ""}
            </p>
            <span className="text-xs text-ink-muted">
              {statusText}
              {showLayer ? ` · ${LAYER_LABEL[item.layer]}` : ""}
            </span>
          </div>

          {item.status === "complete" ? (
            <p className="mt-1 text-xs text-ink-muted">
              {item.rules.length} {item.rules.length === 1 ? "rule" : "rules"}
              {first && sourceOf(first) ? ` · ${sourceOf(first)}` : ""}
            </p>
          ) : null}

          {item.status === "inferred" ? (
            <div className="mt-1.5 flex flex-col gap-2">
              {item.rules.map((r) => (
                <div key={r.id} className="text-sm">
                  <p>
                    {r.rule_code ? <span className="mr-1.5 font-mono text-[11px] text-ink-muted">{r.rule_code}</span> : null}
                    {r.statement ?? r.label}
                  </p>
                  {r.source_evidence || sourceOf(r) ? (
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {r.source_evidence ? `“${r.source_evidence}” ` : ""}
                      {sourceOf(r) ? `(${sourceOf(r)})` : ""}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {item.gap?.why_it_matters ? <p className="mt-1 text-xs text-ink-muted">{item.gap.why_it_matters}</p> : null}

          {mode === "idle" && item.status === "inferred" && first ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={!!busy}
                onClick={() =>
                  run("Confirming…", async () => {
                    for (const r of item.rules) await confirm({ data: { ruleId: r.id, brandId, label: r.label } });
                  })
                }
              >
                Confirm
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setStatement(first.statement ?? "");
                  setValue(ruleValue(first.value));
                  setSeverity(first.severity);
                  setMode("edit");
                }}
              >
                Edit
              </Button>
            </div>
          ) : null}

          {mode === "idle" && item.status === "missing" ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="secondary">
                <Link to="/brands/$brandId" params={{ brandId }}>A · Upload more material</Link>
              </Button>
              <Button size="sm" variant="secondary" onClick={() => { setStatement(""); setValue(""); setSeverity("must"); setMode("define"); }}>
                B · Define manually
              </Button>
              <Button
                size="sm"
                variant="quiet"
                disabled={!!busy}
                onClick={() =>
                  run("Drafting a candidate rule…", async () => {
                    const result = item.gap
                      ? await proposeGap({ data: { gapId: item.gap.id } })
                      : await proposeCat({ data: { brandId, category: item.category ?? "", layer: item.layer } });
                    if (!result.proposed) throw new Error(result.reason);
                  })
                }
              >
                C · Let CoBrand propose
              </Button>
            </div>
          ) : null}

          {mode !== "idle" ? (
            <div className="mt-3 grid gap-2">
              <Textarea rows={3} autoFocus placeholder="Write the rule, e.g. “Maintain clear space equal to the height of the symbol.”" value={statement} onChange={(e) => setStatement(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                <Input className="max-w-xs" placeholder="Value (optional), e.g. #111111" value={value} onChange={(e) => setValue(e.target.value)} />
                <div className="flex gap-1">
                  {["must", "should", "can"].map((s) => (
                    <Button key={s} size="sm" variant={severity === s ? "default" : "secondary"} onClick={() => setSeverity(s)}>
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={!!busy || statement.trim().length < 3}
                  onClick={() =>
                    run("Saving…", async () => {
                      if (mode === "edit" && first) {
                        await save({ data: { ruleId: first.id, brandId, label: first.label, statement: statement.trim(), value, severity, confirm: true } });
                      } else {
                        await addRule({
                          data: {
                            brandId,
                            gapId: item.gap?.id ?? null,
                            layer: item.layer,
                            ruleType: item.category ?? "other",
                            label: item.title,
                            statement: statement.trim(),
                            value,
                            severity,
                          },
                        });
                      }
                    })
                  }
                >
                  Save as brand truth
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setMode("idle")}>Cancel</Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}
