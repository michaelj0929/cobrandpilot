import { createFileRoute, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";

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
import { Swatch, TypeSpecimen, Meter, fontFamilyOf } from "@/components/visuals";
import {
  LAYER_BLURB,
  LAYER_LABEL,
  isColor,
  listGaps,
  listRules,
  listVersions,
  ruleValue,
  type BrandRule,
  type ProposedEdits,
} from "@/lib/cobrand-client";
import { applyEdits, confirmRule, draftEdits, saveRule } from "@/lib/cobrand.functions";



export const Route = createFileRoute("/brands/$brandId/brain")({
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

const LAYERS = ["foundation", "identity", "execution"] as const;

function BrandBrain() {
  const { brandId } = useParams({ from: "/brands/$brandId/brain" });
  const queryClient = useQueryClient();

  const [layer, setLayer] = useState<(typeof LAYERS)[number]>("foundation");
  const [filter, setFilter] = useState("all");
  const [openRule, setOpenRule] = useState<string | null>(null);
  const [request, setRequest] = useState("");
  const [diff, setDiff] = useState<ProposedEdits | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rules = useQuery({ queryKey: ["rules", brandId], queryFn: () => listRules(brandId) });
  const gaps = useQuery({ queryKey: ["gaps", brandId], queryFn: () => listGaps(brandId) });
  const versions = useQuery({
    queryKey: ["versions", brandId],
    queryFn: () => listVersions(brandId),
  });

  const draft = useServerFn(draftEdits);
  const apply = useServerFn(applyEdits);
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

  const layerGaps = (gaps.data ?? []).filter((g) => !g.resolved && g.layer === layer);
  const grouped = useMemo(() => {
    const map = new Map<string, BrandRule[]>();
    for (const rule of layerRules) {
      const key = rule.rule_type;
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

  const askDraft = useMutation({
    mutationFn: async () => {
      setError(null);
      setBusy(true);
      const result = await draft({ data: { brandId, request } });
      setDiff(result);
    },
    onSettled: () => setBusy(false),
    onError: (e) => setError((e as Error).message),
  });

  const applyDiff = useMutation({
    mutationFn: async () => {
      if (!diff) return;
      setBusy(true);
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
      setDiff(null);
      setRequest("");
      refresh();
    },
    onSettled: () => setBusy(false),
    onError: (e) => setError((e as Error).message),
  });

  return (
    <div className="grid gap-16 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {LAYERS.map((l) => (
            <button
              key={l}
              onClick={() => setLayer(l)}
              className={`rounded-full px-4 py-1.5 text-sm transition-all duration-300 ${
                layer === l
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {LAYER_LABEL[l]}
            </button>
          ))}
          <div className="ml-auto w-44">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="h-9 border-transparent bg-muted/60 shadow-none">
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
        <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {LAYER_BLURB[layer]}
        </p>

        {layerGaps.length > 0 ? (
          <div className="mt-8 rounded-[var(--radius)] border border-dashed border-[var(--missing)]/30 bg-[var(--missing)]/[0.04] px-5 py-4">
            <p className="text-sm font-medium">Still missing in {LAYER_LABEL[layer]}</p>
            <ul className="mt-2.5 space-y-1.5 text-sm text-muted-foreground">
              {layerGaps.map((gap) => (
                <li key={gap.id}>
                  {gap.topic} — {gap.gap_type === "vague" ? "too vague to check against" : "not found"}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div key={layer} className="view-enter mt-12 space-y-14">
          {grouped.length === 0 ? (
            <Empty
              title="Nothing here yet"
              body="Upload brand materials and CoBrand will fill this layer in."
            />
          ) : (
            grouped.map(([type, typeRules]) => (
              <section key={type}>
                <p className="eyebrow mb-5">{type.replace(/_/g, " ")}</p>

                {type === "color" ? (
                  <div className="mb-6 grid gap-4 sm:grid-cols-3">
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

                {type === "typography" ? (
                  <div className="mb-6 grid gap-4 sm:grid-cols-2">
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

                <div className="space-y-3">

                  {typeRules.map((rule) => (
                    <RuleCard
                      key={rule.id}
                      rule={rule}
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
                </div>
              </section>
            ))
          )}
        </div>
      </div>

      <aside className="space-y-10 lg:sticky lg:top-28 lg:self-start">
        <div>
          <p className="eyebrow">Model status</p>
          <p className="display mt-3 text-[2.5rem] leading-none">{counts.total}</p>
          <p className="mt-1 text-sm text-muted-foreground">rules held about this brand</p>
          <div className="mt-5">
            <Meter
              value={counts.total ? (counts.confirmed / counts.total) * 100 : 0}
              tone="var(--confirmed)"
            />
            <p className="mt-2.5 text-xs text-muted-foreground">
              {counts.confirmed} confirmed · {counts.review} awaiting review
            </p>
          </div>
        </div>

        <div className="surface p-6">
          <p className="eyebrow">Change it in plain language</p>
          <Textarea
            className="mt-4 border-transparent bg-muted/50 shadow-none"
            rows={3}
            placeholder='e.g. "Our primary blue is #0B3D91, not #0A47A1"'
            value={request}
            onChange={(e) => setRequest(e.target.value)}
          />
          <Button
            className="mt-4"
            size="sm"
            disabled={busy || request.trim().length < 5}
            onClick={() => askDraft.mutate()}
          >
            {busy ? "Thinking…" : "Propose change"}
          </Button>

          {diff ? (
            <div className="reveal-enter mt-5 border-t border-border/60 pt-5">
              <p className="text-sm">{diff.understood}</p>
              {diff.question ? (
                <p className="mt-2 text-xs text-muted-foreground">{diff.question}</p>
              ) : null}
              <ul className="mt-4 space-y-2.5 text-sm">
                {diff.changes.map((change, i) => (
                  <li
                    key={i}
                    className="rounded-[calc(var(--radius)-4px)] bg-muted/50 px-3 py-2.5"
                  >
                    <p className="eyebrow text-[10px]">
                      {change.action} · {change.field}
                    </p>
                    <p className="mt-1.5 font-medium">{change.label}</p>
                    {change.old_value ? (
                      <p className="text-xs text-muted-foreground line-through">
                        {change.old_value}
                      </p>
                    ) : null}
                    <p className="text-xs">{change.new_value}</p>
                  </li>
                ))}
              </ul>
              {diff.changes.length > 0 ? (
                <div className="mt-4 flex gap-2">
                  <Button size="sm" disabled={busy} onClick={() => applyDiff.mutate()}>
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

        <div>
          <p className="eyebrow">History</p>
          <ul className="mt-4 space-y-5 text-sm">
            {(versions.data ?? []).slice(0, 10).map((version) => (
              <li key={version.id} className="border-l border-border pl-4">
                <p className="font-medium">v{version.version}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {version.diff_summary}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(version.created_at).toLocaleString()} · via {version.edited_via}
                </p>
              </li>
            ))}
            {(versions.data ?? []).length === 0 ? (
              <li className="text-xs text-muted-foreground">No changes recorded yet.</li>
            ) : null}
          </ul>
        </div>
      </aside>

    </div>
  );
}

function RuleCard({
  rule,
  open,
  onToggle,
  onSave,
  onConfirm,
}: {
  rule: BrandRule;
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

  const raw = ruleValue(rule.value);

  return (
    <div
      className={`surface px-5 py-4 transition-shadow duration-300 ${
        open ? "shadow-[var(--shadow-lift)]" : ""
      }`}
    >
      <div className="flex items-start gap-4">
        {isColor(raw) ? (
          <span
            className="mt-1 size-9 shrink-0 rounded-full"
            style={{ backgroundColor: raw }}
            aria-hidden
          />
        ) : null}
        <button onClick={onToggle} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3>{rule.label}</h3>
            <StateBadge state={rule.status === "confirmed" ? "confirmed" : rule.review_state} />
            <span className="eyebrow text-[10px]">{rule.severity}</span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{rule.statement}</p>
          {raw ? <p className="mt-2 font-mono text-xs text-muted-foreground">{raw}</p> : null}
        </button>
      </div>

      {rule.conflict_note ? (
        <p className="mt-3 rounded-[calc(var(--radius)-4px)] bg-[var(--missing)]/[0.07] px-3 py-2 text-xs text-[var(--missing)]">
          {rule.conflict_note}
        </p>
      ) : null}



      {open ? (
        <div className="reveal-enter mt-6 border-t border-border/60 pt-6 text-sm">
          <dl className="grid gap-5 sm:grid-cols-2">
            <Detail label="Source" value={rule.source_citation ?? "—"} />
            <Detail label="Applies to" value={`${rule.scope} · ${rule.time_scope}`} />
            <Detail label="Authority" value={rule.authority ?? "Not stated"} />
            <Detail label="Confidence" value={rule.confidence ?? "—"} />
          </dl>
          {rule.source_evidence ? (
            <p
              className="mt-6 border-l-2 pl-4 text-sm italic leading-relaxed text-muted-foreground"
              style={{ borderColor: "var(--brand-accent)" }}
            >
              “{rule.source_evidence}”
            </p>
          ) : null}
          {(rule.rule_examples ?? []).length > 0 ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {(rule.rule_examples ?? []).map((ex) => (
                <div
                  key={ex.id}
                  className={`rounded-[calc(var(--radius)-4px)] px-3.5 py-3 text-xs ${
                    ex.example_type === "do"
                      ? "bg-[var(--confirmed)]/[0.07]"
                      : "bg-[var(--missing)]/[0.07]"
                  }`}
                >
                  <p className="eyebrow text-[10px]">
                    {ex.example_type === "do" ? "Do" : "Don't"}
                  </p>
                  <p className="mt-1.5 leading-relaxed text-muted-foreground">{ex.description}</p>
                </div>
              ))}
            </div>

          ) : null}

          {editing ? (
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
    </div>
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
