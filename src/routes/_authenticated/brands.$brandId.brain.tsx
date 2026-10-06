import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, TriangleAlert, Upload } from "lucide-react";
import { useMemo, useState } from "react";

import { Empty, PageHead, StateBadge } from "@/components/app-shell";
import { BrandScopePicker } from "@/components/brand-scope";
import { SubBrandActions } from "@/components/sub-brands";
import { BrandStatusCard } from "@/components/brand-status";
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
import { Swatch, TypeSpecimen, fontFamilyOf } from "@/components/visuals";
import {
  LAYER_BLURB,
  LAYER_LABEL,
  LAYER_QUESTION,
  LAYERS,
  categoryLabel,
  isColor,
  listGaps,
  listRules,
  BRAND_KIND_LABEL,
  getBrand,
  getBrandFamilyOf,
  listVersions,
  ruleValue,
  type BrandRule,
  type ProposedEdits,
} from "@/lib/cobrand-client";
import { applyEdits, confirmRule, draftEdits, saveRule } from "@/lib/cobrand.functions";

export const Route = createFileRoute("/_authenticated/brands/$brandId/brain")({
  head: () => ({
    meta: [
      { title: "Brand Brain — CoBrand" },
      {
        name: "description",
        content:
          "Explore every rule CoBrand holds about the brand, see what is confirmed or inferred, and correct it.",
      },
      { property: "og:title", content: "Brand Brain — CoBrand" },
      {
        property: "og:description",
        content: "Explore, confirm and correct every rule in the brand model.",
      },
    ],
  }),
  component: BrandBrain,
});

function BrandBrain() {
  const { brandId } = useParams({ from: "/_authenticated/brands/$brandId/brain" });
  const queryClient = useQueryClient();

  const [layer, setLayer] = useState<(typeof LAYERS)[number]>("intent");
  const [filter, setFilter] = useState("all");
  const [openRule, setOpenRule] = useState<string | null>(null);

  const rules = useQuery({ queryKey: ["rules", brandId], queryFn: () => listRules(brandId) });
  const gaps = useQuery({ queryKey: ["gaps", brandId], queryFn: () => listGaps(brandId) });
  const navigate = useNavigate();
  const brand = useQuery({ queryKey: ["brand", brandId], queryFn: () => getBrand(brandId) });
  const parentId = brand.data?.parent_brand_id ?? null;
  const master = useQuery({
    queryKey: ["brand", parentId],
    queryFn: () => getBrand(parentId ?? ""),
    enabled: parentId !== null,
  });
  const family = useQuery({
    queryKey: ["family-of", brandId],
    queryFn: () => getBrandFamilyOf(brandId),
  });
  const versions = useQuery({
    queryKey: ["versions", brandId],
    queryFn: () => listVersions(brandId),
  });

  const save = useServerFn(saveRule);
  const confirm = useServerFn(confirmRule);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["rules", brandId] });
    queryClient.invalidateQueries({ queryKey: ["versions", brandId] });
    queryClient.invalidateQueries({ queryKey: ["brand", brandId] });
  };

  const layerRules = useMemo(() => {
    const all = (rules.data ?? []).filter((r) => r.layer === layer && r.status !== "archived");
    if (filter === "confirmed") return all.filter((r) => r.status === "confirmed");
    if (filter === "review") return all.filter((r) => r.status !== "confirmed");
    return all;
  }, [rules.data, layer, filter]);

  const openGapCount = (gaps.data ?? []).filter((g) => !g.resolved).length;
  const layerGaps = (gaps.data ?? []).filter((g) => !g.resolved && g.layer === layer);
  const grouped = useMemo(() => {
    const map = new Map<string, BrandRule[]>();
    for (const rule of layerRules) {
      const key = rule.category ?? rule.rule_type;
      map.set(key, [...(map.get(key) ?? []), rule]);
    }
    return [...map.entries()];
  }, [layerRules]);

  const counts = useMemo(() => {
    const all = (rules.data ?? []).filter((r) => r.status !== "archived");
    return {
      total: all.length,
      confirmed: all.filter((r) => r.status === "confirmed").length,
      review: all.filter((r) => r.status !== "confirmed").length,
    };
  }, [rules.data]);

  const statusBlock = (
    <BrandStatusCard
      brandId={brandId}
      total={counts.total}
      confirmed={counts.confirmed}
      review={counts.review}
      missing={openGapCount}
    />
  );

  return (
    <>
      {parentId ? (
        <PageHead
          {...(brand.data ? { eyebrow: BRAND_KIND_LABEL[brand.data.kind] } : {})}
          title={`${brand.data?.name ?? ""} guidelines`}
          description={`Rules that only apply to ${brand.data?.name ?? "this sub-brand"}. Checks that select it use these on top of the ${master.data?.name ?? "master brand"} brand system; ${master.data?.name ?? "master brand"} Must rules still win.`}
        />
      ) : (
        <PageHead
          eyebrow="Master brand"
          title="Your brand system"
          description="The knowledge base every check runs against. Explore every rule CoBrand holds about the brand, see what is confirmed or inferred, and correct it."
        />
      )}
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_300px]">
        <div className="flex min-w-0 flex-col gap-5">
          <div>
            <BrandScopePicker brandId={brandId} to="/brands/$brandId/brain" label="Brand" />
            {parentId && brand.data ? (
              <div className="-mt-2 mb-4 flex items-center gap-2 text-xs text-ink-muted">
                <span>Remove {brand.data.name} from {master.data?.name ?? "the master brand"}</span>
                <SubBrandActions
                  sub={brand.data}
                  onDeleted={() => navigate({ to: "/brands/$brandId/brain", params: { brandId: parentId } })}
                />
              </div>
            ) : null}

            <div
              role="tablist"
              aria-label="Brand layers"
              className="mb-2 flex flex-wrap items-center gap-2"
            >
              {LAYERS.map((l) => {
                const count = (rules.data ?? []).filter(
                  (r) => r.layer === l && r.status !== "archived",
                ).length;
                return (
                  <button
                    key={l}
                    role="tab"
                    aria-selected={layer === l}
                    onClick={() => setLayer(l)}
                    className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                      layer === l
                        ? "border-foreground bg-foreground text-background"
                        : "border-line-soft bg-card text-ink hover:bg-brand-tint/40"
                    }`}
                  >
                    {LAYER_LABEL[l]}
                    <span
                      className={`ml-1.5 text-xs ${layer === l ? "opacity-70" : "text-ink-muted"}`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-ink-muted">{LAYER_QUESTION[layer]}</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-sm text-ink-muted">{LAYER_BLURB[layer]}</p>
            <div className="ml-auto w-44">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Everything</SelectItem>
                  <SelectItem value="confirmed">Confirmed only</SelectItem>
                  <SelectItem value="review">Needs review</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {layerGaps.length > 0 ? (
            <div className="flex items-start gap-3 rounded-lg bg-yellow-tint px-4 py-3.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-attention text-ink">
                <TriangleAlert aria-hidden className="size-[18px]" />
              </span>
              <div>
                <p className="text-sm font-semibold">Still missing in {LAYER_LABEL[layer]}</p>
                <ul className="mt-1 space-y-1 text-sm">
                  {layerGaps.map((gap) => (
                    <li key={gap.id}>
                      {gap.topic} —{" "}
                      {gap.gap_type === "vague" ? "too vague to check against" : "not found"}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          <div key={layer} className="view-enter flex flex-col gap-5">
            {grouped.length === 0 ? (
              <Empty
                title="Nothing here yet"
                body="Upload brand materials and CoBrand will fill this layer in."
              />
            ) : (
              grouped.map(([type, typeRules]) => (
                <section key={type} className="surface px-6 py-[22px]">
                  <h2 className="text-[13px] leading-[18px] tracking-[0.2px] lowercase">
                    {categoryLabel(type)}
                  </h2>

                  {/colou?r/.test(type) ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      {typeRules
                        .filter((r) => isColor(ruleValue(r.value)))
                        .map((r) => (
                          <Swatch
                            key={`sw-${r.id}`}
                            hex={ruleValue(r.value).trim()}
                            name={r.label}
                            {...(r.statement ? { note: r.statement } : {})}
                          />
                        ))}
                    </div>
                  ) : null}

                  {type === "typography" || type === "type_hierarchy" ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {typeRules.map((r) => {
                        const family = fontFamilyOf(r);
                        return family ? (
                          <TypeSpecimen
                            key={`ts-${r.id}`}
                            family={family}
                            name={r.label}
                            {...(r.statement ? { note: r.statement } : {})}
                          />
                        ) : null;
                      })}
                    </div>
                  ) : null}

                  <ul className="mt-2">
                    {typeRules.map((rule) => (
                      <RuleCard
                        key={rule.id}
                        rule={rule}
                        brandId={brandId}
                        onApplied={refresh}
                        open={openRule === rule.id}
                        onToggle={() => setOpenRule(openRule === rule.id ? null : rule.id)}
                        onSave={async (values) => {
                          await save({ data: { ruleId: rule.id, brandId, ...values } });
                          refresh();
                        }}
                        onConfirm={async () => {
                          await confirm({ data: { ruleId: rule.id, brandId, label: rule.label } });
                          refresh();
                        }}
                      />
                    ))}
                  </ul>
                </section>
              ))
            )}
          </div>
        </div>
        <aside className="order-first lg:order-none lg:sticky lg:top-8">{statusBlock}</aside>
      </div>

      <section className="surface mt-10 px-6 py-[22px]">
        <h2 className="text-[13px] leading-[18px] tracking-[0.2px]">History</h2>
        <ul className="mt-1.5">
          {(versions.data ?? []).slice(0, 10).map((version) => (
            <li
              key={version.id}
              className="border-t border-line-soft py-3 text-sm first:border-t-0"
            >
              <p className="font-semibold">v{version.version}</p>
              <p className="mt-0.5 text-xs text-ink">{version.diff_summary}</p>
              <p className="mt-1 text-xs text-ink-muted">
                {new Date(version.created_at).toLocaleString()} · via {version.edited_via}
              </p>
            </li>
          ))}
          {(versions.data ?? []).length === 0 ? (
            <li className="py-3 text-xs text-ink-muted">No changes recorded yet.</li>
          ) : null}
        </ul>
      </section>
    </>
  );
}
function RuleCard({
  rule,
  brandId,
  onApplied,
  open,
  onToggle,
  onSave,
  onConfirm,
}: {
  rule: BrandRule;
  brandId: string;
  onApplied: () => void;
  open: boolean;
  onToggle: () => void;
  onSave: (values: {
    label: string;
    statement: string;
    value: string;
    severity: string;
    confirm: boolean;
  }) => Promise<void>;
  onConfirm: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(rule.label);
  const [statement, setStatement] = useState(rule.statement ?? "");
  const [value, setValue] = useState(ruleValue(rule.value));
  const [severity, setSeverity] = useState(rule.severity);
  const [saving, setSaving] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const raw = ruleValue(rule.value);

  return (
    <li className="border-t border-line-soft py-4 first:border-t-0">
      <div className="flex items-start gap-4">
        {isColor(raw) ? (
          <span
            className="mt-0.5 size-[38px] shrink-0 rounded-[9px] shadow-[inset_0_0_0_1px_rgba(30,32,70,0.08)]"
            style={{ backgroundColor: raw }}
            aria-hidden
          />
        ) : null}
        <button
          onClick={onToggle}
          aria-expanded={open}
          className="min-w-0 flex-1 cursor-pointer rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-brand"
        >
          <div className="flex flex-wrap items-center gap-2">
            {rule.rule_code ? (
              <span className="font-mono text-[11px] text-ink-muted">{rule.rule_code}</span>
            ) : null}
            <h3 className="text-sm leading-5">{rule.label}</h3>
            <StateBadge state={rule.status === "confirmed" ? "confirmed" : rule.review_state} />
            <span className="text-xs font-semibold text-ink-muted lowercase">{rule.severity}</span>
          </div>
          <p className="mt-1 text-sm text-ink">{rule.statement}</p>
          {raw ? <p className="mt-1.5 font-mono text-xs text-ink-muted">{raw}</p> : null}
        </button>
      </div>

      {rule.conflict_note ? (
        <p className="mt-3 rounded-md bg-[var(--missing)]/[0.07] px-3 py-2 text-xs text-[var(--missing)]">
          {rule.conflict_note}
        </p>
      ) : null}

      {open ? (
        <div className="reveal-enter mt-4 rounded-md bg-page px-4 py-4 text-sm">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail
              label="Source"
              value={
                rule.source_document
                  ? `${rule.source_document}${rule.source_page ? `, p.${rule.source_page}` : ""}`
                  : (rule.source_citation ?? "—")
              }
            />
            <Detail
              label="Applies to"
              value={`${(rule.scope_tags?.length ? rule.scope_tags : [rule.scope]).join(", ")} · ${rule.time_scope}`}
            />
            <Detail label="Authority" value={rule.authority ?? "Not stated"} />
            <Detail
              label="Confidence"
              value={
                rule.confidence_score != null
                  ? `${Math.round(Number(rule.confidence_score) * 100)}%`
                  : (rule.confidence ?? "—")
              }
            />
          </dl>
          {rule.source_evidence ? (
            <p className="mt-4 rounded-md bg-card px-4 py-3 text-sm text-ink italic">
              “{rule.source_evidence}”
            </p>
          ) : null}
          {(rule.rule_examples ?? []).length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(rule.rule_examples ?? []).map((ex) => (
                <div
                  key={ex.id}
                  className={`rounded-md px-3.5 py-3 text-xs ${
                    ex.example_type === "do" ? "bg-green-tint" : "bg-[var(--missing)]/[0.07]"
                  }`}
                >
                  <p
                    className={`text-[13px] font-semibold ${
                      ex.example_type === "do" ? "text-green" : "text-[var(--missing)]"
                    }`}
                  >
                    {ex.example_type === "do" ? "Do" : "Don't"}
                  </p>
                  <p className="mt-1 text-ink">{ex.description}</p>
                </div>
              ))}
            </div>
          ) : null}

          {aiOpen ? (
            <AiEdit
              rule={rule}
              brandId={brandId}
              onClose={() => setAiOpen(false)}
              onApplied={() => {
                setAiOpen(false);
                onApplied();
              }}
            />
          ) : editing ? (
            <div className="mt-4 grid gap-3">
              <div className="grid gap-1.5">
                <Label>Name</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Rule</Label>
                <Textarea
                  rows={3}
                  value={statement}
                  onChange={(e) => setStatement(e.target.value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Value</Label>
                  <Input value={value} onChange={(e) => setValue(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Strength</Label>
                  <Select value={severity} onValueChange={setSeverity}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="must">Must</SelectItem>
                      <SelectItem value="should">Should</SelectItem>
                      <SelectItem value="can">Can</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true);
                    await onSave({ label, statement, value, severity, confirm: true });
                    setSaving(false);
                    setEditing(false);
                  }}
                >
                  Save and confirm
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setAiOpen(true)}>
                <Sparkles aria-hidden />
                Edit with CoBrand
              </Button>
              {rule.status !== "confirmed" ? (
                <Button
                  size="sm"
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true);
                    await onConfirm();
                    setSaving(false);
                  }}
                >
                  Confirm as brand truth
                </Button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </li>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 text-sm">{value}</dd>
    </div>
  );
}

function AiEdit({
  rule,
  brandId,
  onClose,
  onApplied,
}: {
  rule: BrandRule;
  brandId: string;
  onClose: () => void;
  onApplied: () => void;
}) {
  const draft = useServerFn(draftEdits);
  const apply = useServerFn(applyEdits);
  const [request, setRequest] = useState("");
  const [diff, setDiff] = useState<ProposedEdits | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="reveal-enter mt-4 rounded-md bg-card px-4 py-4">
      <p className="text-[13px] font-semibold">Edit with CoBrand</p>
      <p className="mt-0.5 text-xs text-ink-muted">
        Describe what should change. CoBrand will shape the rule to fit your ask and the rest of the
        brand.
      </p>
      <Textarea
        className="mt-3"
        rows={3}
        placeholder='e.g. "Make this feel less strict for social posts"'
        value={request}
        onChange={(e) => setRequest(e.target.value)}
      />
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          disabled={busy || request.trim().length < 3}
          onClick={() =>
            run(async () => {
              setDiff(await draft({ data: { brandId, request, ruleId: rule.id } }));
            })
          }
        >
          {busy && !diff ? "Thinking…" : "Suggest changes"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>

      {diff ? (
        <div className="reveal-enter mt-5 border-t border-line-soft pt-5">
          <p className="text-sm">{diff.understood}</p>
          {diff.question ? <p className="mt-2 text-xs text-ink-muted">{diff.question}</p> : null}
          <ul className="mt-4 space-y-2.5 text-sm">
            {diff.changes.map((change, i) => (
              <li key={i} className="rounded-md bg-page px-3.5 py-3">
                <p className="text-[11px] font-semibold text-ink-muted lowercase">
                  {change.action} · {change.field}
                </p>
                <p className="mt-1 font-semibold">{change.label}</p>
                {change.old_value ? (
                  <p className="text-xs text-ink-muted line-through">{change.old_value}</p>
                ) : null}
                <p className="text-xs">{change.new_value}</p>
              </li>
            ))}
          </ul>
          {diff.changes.length > 0 ? (
            <div className="mt-4 flex gap-2">
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await apply({
                      data: {
                        brandId,
                        summary: diff.understood,
                        changes: diff.changes.map((c) => ({
                          action: c.action,
                          rule_id: c.rule_id,
                          label: c.label,
                          field: c.field,
                          old_value: c.old_value,
                          new_value: c.new_value,
                          layer: c.layer,
                          rule_type: c.rule_type,
                          severity: c.severity,
                        })),
                      },
                    });
                    onApplied();
                  })
                }
              >
                Apply changes
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDiff(null)}>
                Discard
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
