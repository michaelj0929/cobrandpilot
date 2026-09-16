import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { resolveContext, reviewCreative, writeRecommendations } from "./agents.server";
import { prepareSource } from "./source-parsing.server";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function describeContext(context: Record<string, unknown>) {
  const entries = Object.entries(context).filter(([, v]) => v);
  if (entries.length === 0) return "No context was given.";
  return entries.map(([k, v]) => `${k.replace(/_/g, " ")}: ${String(v)}`).join("; ");
}

async function loadCheck(checkId: string) {
  const supabase = await db();
  const { data: check } = await supabase
    .from("validation_checks")
    .select("*")
    .eq("id", checkId)
    .maybeSingle();
  if (!check) throw new Error("That review could not be found.");

  const { data: brand } = await supabase
    .from("brands")
    .select("id, name, current_version")
    .eq("id", check.brand_id)
    .maybeSingle();

  const { data: rules } = await supabase
    .from("rules")
    .select(
      "id, layer, rule_type, label, statement, value, severity, scope, time_scope, status, source_citation, context_tags(channel, format, audience, market, funnel_stage, objective, product, campaign)",
    )
    .eq("brand_id", check.brand_id)
    .not("status", "in", "(archived,superseded)");

  return { supabase, check, brand, rules: rules ?? [] };
}

type LoadedRule = Awaited<ReturnType<typeof loadCheck>>["rules"][number];

function ruleLines(rules: LoadedRule[]) {
  return rules
    .map((r) => {
      const value =
        r.value && typeof r.value === "object" && "raw" in (r.value as Record<string, unknown>)
          ? String((r.value as Record<string, unknown>)["raw"] ?? "")
          : "";
      const tags = (r.context_tags ?? [])
        .map((t) =>
          Object.entries(t)
            .filter(([, v]) => v)
            .map(([k, v]) => `${k}=${String(v)}`)
            .join(","),
        )
        .join(" | ");
      return `${r.id} | ${r.layer} | ${r.rule_type} | ${r.label} | ${r.statement ?? ""} | ${value} | ${r.severity} | ${r.scope} | ${r.time_scope} | ${r.status} | ${tags}`;
    })
    .join("\n");
}

async function loadAsset(check: {
  asset_path: string | null;
  asset_mime: string | null;
  asset_name: string | null;
}) {
  if (!check.asset_path) return { file: null, text: null as string | null };
  const supabase = await db();
  const { data: blob } = await supabase.storage.from("creatives").download(check.asset_path);
  if (!blob) return { file: null, text: null };
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const prepared = prepareSource(bytes, check.asset_mime ?? "", check.asset_name ?? "creative");
  return { file: prepared.file, text: prepared.text };
}

function creativeSummary(check: {
  input_type: string;
  brief_text: string | null;
  copy_text: string | null;
  asset_name: string | null;
}) {
  const parts: string[] = [`Submitted as: ${check.input_type}`];
  if (check.asset_name) parts.push(`Visual asset: ${check.asset_name}`);
  if (check.brief_text) parts.push(`Brief: ${check.brief_text.slice(0, 3000)}`);
  if (check.copy_text) parts.push(`Copy: ${check.copy_text.slice(0, 3000)}`);
  return parts.join("\n");
}

/* ------------------------------------------------- Contextual readiness */

export const checkReadiness = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ checkId: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const { supabase, check, brand, rules } = await loadCheck(data.checkId);
    const context = describeContext((check.creative_context ?? {}) as Record<string, unknown>);

    const resolution = await resolveContext({
      brandName: brand?.name ?? "the brand",
      context,
      creativeSummary: creativeSummary(check),
      rules: ruleLines(rules),
    });

    await supabase
      .from("validation_checks")
      .update({
        readiness: resolution.readiness,
        applied_rules: {
          applicable: resolution.applicable_rule_ids,
          excluded: resolution.excluded_rule_ids,
          priority_notes: resolution.priority_notes,
          reasons: resolution.rule_reasons,
        },
        status: "ready",
      })
      .eq("id", check.id);

    return resolution;
  });

/* ------------------------------------------------------------ Full review */

export const runReview = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ checkId: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const { supabase, check, brand, rules } = await loadCheck(data.checkId);
    const brandName = brand?.name ?? "the brand";
    const context = describeContext((check.creative_context ?? {}) as Record<string, unknown>);

    await supabase
      .from("validation_checks")
      .update({ status: "reviewing", error: null })
      .eq("id", check.id);

    try {
      let applied = check.applied_rules as {
        applicable?: string[];
        reasons?: { rule_id: string; applies_because: string }[];
        priority_notes?: string;
      } | null;
      let readiness = check.readiness as Record<string, unknown> | null;

      if (!applied || !readiness) {
        const resolution = await resolveContext({
          brandName,
          context,
          creativeSummary: creativeSummary(check),
          rules: ruleLines(rules),
        });
        applied = {
          applicable: resolution.applicable_rule_ids,
          reasons: resolution.rule_reasons,
          priority_notes: resolution.priority_notes,
        };
        readiness = resolution.readiness as unknown as Record<string, unknown>;
        await supabase
          .from("validation_checks")
          .update({ readiness: readiness as never, applied_rules: applied as never })
          .eq("id", check.id);
      }

      const applicableIds = new Set(applied.applicable ?? []);
      const scoped = rules.filter((r) => applicableIds.has(r.id));
      const usedRules = scoped.length > 0 ? scoped : rules;

      const asset = await loadAsset(check);

      // Agent F — three-pass review.
      const review = await reviewCreative({
        brandName,
        context,
        rules: usedRules
          .map((r) => `${r.id} | ${r.statement ?? r.label} | ${r.severity} | ${r.source_citation ?? ""}`)
          .join("\n"),
        copyText: check.copy_text ?? asset.text,
        briefText: check.brief_text,
        file: asset.file,
      });

      // Agent G — creator-ready recommendations and scoring.
      const result = await writeRecommendations({
        brandName,
        context,
        observations: JSON.stringify(review.observations),
        readiness: JSON.stringify(readiness),
        ruleReasons: JSON.stringify(applied.reasons ?? []),
      });

      const ruleById = new Map(usedRules.map((r) => [r.id, r]));
      const reasonById = new Map((applied.reasons ?? []).map((r) => [r.rule_id, r.applies_because]));

      await supabase.from("findings").delete().eq("check_id", check.id);
      if (result.findings.length > 0) {
        await supabase.from("findings").insert(
          result.findings.map((f, index) => {
            const rule = f.rule_id ? ruleById.get(f.rule_id) : undefined;
            return {
              check_id: check.id,
              number: f.number || index + 1,
              rule_id: rule?.id ?? null,
              title: f.title,
              pass_name: f.pass_name,
              dimension: f.dimension,
              severity: f.severity,
              confidence: f.confidence,
              status: f.status,
              explanation: f.explanation,
              why_it_matters: f.why_it_matters,
              rule_statement: f.rule_statement || rule?.statement || null,
              source_citation: f.source_citation || rule?.source_citation || null,
              suggested_fix: f.suggested_fix,
              quote: f.quote,
              pin_x: f.pin_x,
              pin_y: f.pin_y,
              applies_because: rule ? (reasonById.get(rule.id) ?? null) : null,
            };
          }),
        );
      }

      await supabase
        .from("validation_checks")
        .update({
          status: "complete",
          score: Math.round(result.score),
          label: result.label,
          summary: result.summary,
          dimension_scores: result.dimension_scores,
          brand_model_version: brand?.current_version ?? 1,
        })
        .eq("id", check.id);

      return { score: result.score, label: result.label, findings: result.findings.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : "The review failed.";
      await supabase
        .from("validation_checks")
        .update({ status: "failed", error: message })
        .eq("id", check.id);
      throw new Error(message);
    }
  });
