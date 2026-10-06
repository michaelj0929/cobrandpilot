import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAccess } from "./access.server";

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

  // sub_brand_ids comes from migration 20261002230000; cast until types regenerate.
  const subBrandIds = (check as { sub_brand_ids?: string[] | null }).sub_brand_ids ?? [];
  const brandIds = [check.brand_id, ...subBrandIds.filter((id) => id !== check.brand_id)];

  const { data: brands } = await supabase.from("brands").select("*").in("id", brandIds);
  const brand = (brands ?? []).find((b) => b.id === check.brand_id) ?? null;
  const subBrands = (brands ?? []).filter((b) => b.id !== check.brand_id);

  // Where each rule comes from, so agents can apply the master brand's Musts
  // over any sub-brand / product-line guideline.
  const origin = new Map<string, string>([
    [check.brand_id, `master brand ${brand?.name ?? ""}`.trim()],
  ]);
  for (const sub of subBrands) {
    const kind = (sub as { kind?: string }).kind === "product_line" ? "product line" : "sub-brand";
    origin.set(sub.id, `${kind} ${sub.name}`);
  }

  const { data: rules } = await supabase
    .from("rules")
    .select(
      "id, brand_id, rule_code, category, layer, rule_type, label, statement, value, severity, scope, scope_tags, time_scope, authority, source_document, source_page, confidence_score, status, source_citation, context_tags(channel, format, audience, market, funnel_stage, objective, product, campaign)",
    )
    .in("brand_id", brandIds)
    .not("status", "in", "(archived,superseded)");

  return {
    supabase,
    check,
    brand,
    subBrands,
    rules: (rules ?? []).map((r) => ({ ...r, origin: origin.get(r.brand_id) ?? "master brand" })),
  };
}

type LoadedRule = Awaited<ReturnType<typeof loadCheck>>["rules"][number];

/** "Nike" or "Nike + Air Max (product line)" for agent prompts. */
function guidelineSetName(
  brand: { name: string } | null,
  subBrands: { name: string; kind?: string }[],
) {
  const base = brand?.name ?? "the brand";
  if (subBrands.length === 0) return base;
  return `${base} (master brand) + ${subBrands
    .map((s) => `${s.name} (${s.kind === "product_line" ? "product line" : "sub-brand"})`)
    .join(" + ")}`;
}

/** Rules as structured records — exactly what the reviewer checks against. */
function ruleLines(rules: LoadedRule[]) {
  return JSON.stringify(
    rules.map((r) => {
      const raw =
        r.value && typeof r.value === "object" && "raw" in (r.value as Record<string, unknown>)
          ? String((r.value as Record<string, unknown>)["raw"] ?? "")
          : null;
      const context = Object.fromEntries(
        (r.context_tags ?? []).flatMap((t) => Object.entries(t).filter(([, v]) => v)),
      );
      return {
        id: r.id,
        rule_code: r.rule_code,
        origin: r.origin,
        layer: r.layer,
        category: r.category ?? r.rule_type,
        label: r.label,
        rule: r.statement,
        value: raw || null,
        severity: r.severity,
        scope: r.scope_tags?.length ? r.scope_tags : [r.scope],
        time: r.time_scope,
        authority: r.authority,
        source_document: r.source_document,
        source_page: r.source_page,
        confidence: r.confidence_score,
        status: r.status,
        ...(Object.keys(context).length ? { context } : {}),
      };
    }),
    null,
    1,
  );
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

type SupportingFile = { path: string; name: string; mime: string };

async function loadSupportingFiles(value: unknown, label: string) {
  if (!Array.isArray(value)) return { files: [] as NonNullable<ReturnType<typeof prepareSource>["file"]>[], texts: [] as string[] };
  const supabase = await db();
  const files: NonNullable<ReturnType<typeof prepareSource>["file"]>[] = [];
  const texts: string[] = [];
  for (const item of value as SupportingFile[]) {
    if (!item?.path || !item?.name) continue;
    const { data: blob } = await supabase.storage.from("creatives").download(item.path);
    if (!blob) continue;
    const prepared = prepareSource(new Uint8Array(await blob.arrayBuffer()), item.mime ?? "", item.name);
    if (prepared.file) files.push(prepared.file);
    if (prepared.text) texts.push(`${label} file: ${item.name}\n${prepared.text}`);
  }
  return { files, texts };
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ checkId: z.string() }).parse(input))
  .handler(async ({ data, context: auth }) => {
    await assertAccess(auth.supabase, "validation_checks", data.checkId);
    const { supabase, check, brand, subBrands, rules } = await loadCheck(data.checkId);
    const context = describeContext((check.creative_context ?? {}) as Record<string, unknown>);

    const resolution = await resolveContext({
      brandName: guidelineSetName(brand, subBrands),
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ checkId: z.string() }).parse(input))
  .handler(async ({ data, context: auth }) => {
    await assertAccess(auth.supabase, "validation_checks", data.checkId);
    const { supabase, check, brand, subBrands, rules } = await loadCheck(data.checkId);
    const brandName = guidelineSetName(brand, subBrands);
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
      const briefFiles = await loadSupportingFiles(
        (check as { brief_files?: unknown }).brief_files,
        "Creative brief",
      );
      const copyFiles = await loadSupportingFiles(
        (check as { copy_files?: unknown }).copy_files,
        "Copy",
      );

      // Agent F — three-pass review.
      const review = await reviewCreative({
        brandName,
        context,
        rules: usedRules
          .map(
            (r) =>
              `${r.id} | ${r.origin} | ${r.statement ?? r.label} | ${r.severity} | ${r.source_citation ?? ""}`,
          )
          .join("\n"),
        copyText: [check.copy_text, ...copyFiles.texts].filter(Boolean).join("\n\n") || null,
        briefText: [check.brief_text, ...briefFiles.texts].filter(Boolean).join("\n\n") || null,
        files: [asset.file, ...briefFiles.files, ...copyFiles.files].filter(
          (file): file is NonNullable<typeof file> => file !== null,
        ),
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
      const reasonById = new Map(
        (applied.reasons ?? []).map((r) => [r.rule_id, r.applies_because]),
      );

      await supabase.from("findings").delete().eq("check_id", check.id);
      if (result.findings.length > 0) {
        await supabase.from("findings").insert(
          result.findings.map((f, index) => {
            const rule = f.rule_id ? ruleById.get(f.rule_id) : undefined;
            return {
              check_id: check.id,
              number: f.number || index + 1,
              rule_id: rule?.id ?? null,
              rule_code: rule?.rule_code ?? null,
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
