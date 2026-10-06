import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { categoryPrefix, layerOfCategory } from "./brand-layers";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAccess } from "./access.server";

import {
  analyzeGaps,
  classifyDocument,
  extractRules,
  prefillContext,
  proposeEdits,
  proposeRule,
  resolveConflicts,
  type ExtractedRule,
} from "./agents.server";
import { prepareSource } from "./source-parsing.server";

type Db = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function db(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** A brand's master, if it is a sub-brand / product line (else null). */
async function parentBrand(brandId: string) {
  const supabase = await db();
  // parent_brand_id comes from migration 20261002230000; cast until types regenerate.
  const { data } = await supabase.from("brands").select("*").eq("id", brandId).maybeSingle();
  const parentId = (data as { parent_brand_id?: string | null } | null)?.parent_brand_id ?? null;
  if (!parentId) return null;
  const { data: parent } = await supabase
    .from("brands")
    .select("id, name")
    .eq("id", parentId)
    .maybeSingle();
  return parent;
}

function ruleLine(r: {
  id: string;
  layer: string;
  rule_type: string;
  label: string;
  statement: string | null;
  value: unknown;
  severity: string;
  status?: string;
  scope?: string;
  time_scope?: string;
}) {
  const value =
    r.value && typeof r.value === "object" && "raw" in (r.value as Record<string, unknown>)
      ? String((r.value as Record<string, unknown>)["raw"] ?? "")
      : "";
  return `${r.id} | ${r.layer} | ${r.rule_type} | ${r.label} | ${r.statement ?? ""} | ${value} | ${r.severity}${
    r.status ? ` | ${r.status}` : ""
  }`;
}

/** Next stable rule code for a category, e.g. LOGO-004. */
async function nextRuleCode(brandId: string, category: string) {
  const supabase = await db();
  const prefix = categoryPrefix(category);
  const { data } = await supabase
    .from("rules")
    .select("rule_code")
    .eq("brand_id", brandId)
    .like("rule_code", `${prefix}-%`);
  const max = (data ?? []).reduce((m, r) => {
    const n = Number((r.rule_code ?? "").split("-").pop());
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

export async function loadRuleLines(brandId: string) {
  const supabase = await db();
  const { data } = await supabase
    .from("rules")
    .select("id, layer, rule_type, label, statement, value, severity, status, scope, time_scope")
    .eq("brand_id", brandId)
    .not("status", "in", "(archived,superseded)")
    .order("layer");
  return (data ?? []).map(ruleLine).join("\n");
}

async function bumpVersion(brandId: string, diffSummary: string, editedVia: string) {
  const supabase = await db();
  const { data: brand } = await supabase
    .from("brands")
    .select("current_version")
    .eq("id", brandId)
    .maybeSingle();
  const next = (brand?.current_version ?? 1) + 1;
  await supabase.from("brands").update({ current_version: next }).eq("id", brandId);
  await supabase.from("brand_versions").insert({
    brand_id: brandId,
    version: next,
    diff_summary: diffSummary,
    edited_via: editedVia,
  });
  return next;
}

async function readSource(sourceFileId: string) {
  const supabase = await db();
  const { data: source, error } = await supabase
    .from("source_files")
    .select("*")
    .eq("id", sourceFileId)
    .maybeSingle();
  if (error || !source) throw new Error("That uploaded file could not be found.");

  if (source.kind === "text" || !source.storage_path) {
    return {
      source,
      prepared: {
        text: source.pasted_text ?? "",
        file: null,
        note: "Pasted text.",
      },
    };
  }

  const { data: blob, error: dlError } = await supabase.storage
    .from("brand-sources")
    .download(source.storage_path);
  if (dlError || !blob) throw new Error("The uploaded file could not be opened.");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return {
    source,
    prepared: prepareSource(bytes, source.mime_type ?? "", source.file_name),
  };
}

/* ----------------------------------------------------------- Ingest a source */

export const ingestSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ sourceFileId: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAccess(context.supabase, "source_files", data.sourceFileId);
    const supabase = await db();
    const { source, prepared } = await readSource(data.sourceFileId);

    await supabase
      .from("source_files")
      .update({ status: "processing", error: null })
      .eq("id", source.id);

    try {
      const { data: brand } = await supabase
        .from("brands")
        .select("id, name")
        .eq("id", source.brand_id)
        .maybeSingle();
      const brandName = brand?.name ?? "the brand";

      // Agent A — classify (unless the user already chose).
      let classification = source.classification;
      if (!classification) {
        const classified = await classifyDocument({
          fileName: source.file_name,
          text: prepared.text,
          file: prepared.file,
        });
        classification = classified.classification;
        await supabase
          .from("source_files")
          .update({
            suggested_classification: classified.classification,
            classification: classified.classification,
            classification_rationale: classified.rationale,
          })
          .eq("id", source.id);
      }

      // Agent B — extract atomic rules.
      const extraction = await extractRules({
        brandName,
        fileName: source.file_name,
        classification: classification ?? "Other",
        text: prepared.text,
        file: prepared.file,
      });

      // Agent C — compare with confirmed truth. A sub-brand is also checked
      // against its master brand's confirmed rules.
      const master = await parentBrand(source.brand_id);
      const { data: confirmedRows } = await supabase
        .from("rules")
        .select("id, brand_id, layer, rule_type, label, statement, value, severity")
        .in("brand_id", master ? [source.brand_id, master.id] : [source.brand_id])
        .eq("status", "confirmed");
      const confirmed = (confirmedRows ?? []).map((r) =>
        master && r.brand_id === master.id
          ? { ...r, label: `${master.name} (master brand): ${r.label}` }
          : r,
      );

      let conflicts: { incoming_label: string; note: string }[] = [];
      if ((confirmed?.length ?? 0) > 0 && extraction.rules.length > 0) {
        const result = await resolveConflicts({
          existing: (confirmed ?? []).map(ruleLine).join("\n"),
          incoming: extraction.rules
            .map((r) => `${r.label} | ${r.statement} | ${r.value ?? ""} | ${r.severity}`)
            .join("\n"),
        });
        conflicts = result.conflicts.map((c) => ({
          incoming_label: c.incoming_label,
          note: `Conflicts with confirmed rule "${c.existing_label}": ${c.note}`,
        }));
      }

      // Persist rules, examples and context tags.
      for (const rule of extraction.rules as ExtractedRule[]) {
        const conflict = conflicts.find((c) => c.incoming_label === rule.label);
        const { data: inserted } = await supabase
          .from("rules")
          .insert({
            brand_id: source.brand_id,
            source_file_id: source.id,
            layer: layerOfCategory(rule.category) === rule.layer ? rule.layer : layerOfCategory(rule.category),
            category: rule.category,
            rule_code: await nextRuleCode(source.brand_id, rule.category),
            rule_type: rule.rule_type,
            label: rule.label,
            statement: rule.statement,
            value: rule.value ? { raw: rule.value } : {},
            severity: rule.severity,
            scope: rule.scope,
            time_scope: rule.time_scope,
            authority: rule.authority,
            review_state: rule.review_state,
            status: "proposed",
            confidence: rule.confidence,
            confidence_score: Math.max(0, Math.min(1, rule.confidence_score)),
            scope_tags: rule.scope_tags.length ? rule.scope_tags : ["global"],
            source_document: rule.source_document,
            source_page: rule.source_page,
            source_citation: rule.source_citation,
            source_evidence: rule.source_evidence,
            conflict_note: conflict?.note ?? null,
          })
          .select("id")
          .single();

        if (!inserted) continue;

        if (rule.examples.length > 0) {
          await supabase.from("rule_examples").insert(
            rule.examples.map((ex) => ({
              brand_id: source.brand_id,
              rule_id: inserted.id,
              example_type: ex.example_type,
              description: ex.description,
              source_ref: ex.source_ref,
            })),
          );
        }

        const ctx = rule.context;
        if (Object.values(ctx).some((v) => v)) {
          await supabase.from("context_tags").insert({
            brand_id: source.brand_id,
            rule_id: inserted.id,
            channel: ctx.channel,
            format: ctx.format,
            audience: ctx.audience,
            market: ctx.market,
            funnel_stage: ctx.funnel_stage,
            objective: ctx.objective,
            product: ctx.product,
            campaign: ctx.campaign,
          });
        }
      }

      await supabase
        .from("source_files")
        .update({
          status: "done",
          rules_extracted: extraction.rules.length,
          error: null,
        })
        .eq("id", source.id);

      await bumpVersion(
        source.brand_id,
        `Ingested ${source.file_name} — ${extraction.rules.length} rules extracted.`,
        "propose",
      );

      return {
        rules: extraction.rules.length,
        conflicts: conflicts.length,
        notes: extraction.notes,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ingestion failed.";
      await supabase
        .from("source_files")
        .update({ status: "failed", error: message })
        .eq("id", source.id);
      throw new Error(message);
    }
  });

/* -------------------------------------------------------------- Gap check */

export const runGapCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ brandId: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAccess(context.supabase, "brands", data.brandId);
    const supabase = await db();
    const { data: brand } = await supabase
      .from("brands")
      .select("id, name")
      .eq("id", data.brandId)
      .maybeSingle();

    // The essential checklist belongs to the master brand. A sub-brand or
    // product line only adds to it, so it has no setup gaps of its own.
    if (await parentBrand(data.brandId)) {
      await supabase.from("setup_gaps").delete().eq("brand_id", data.brandId).eq("resolved", false);
      return { gaps: [], summary: "Sub-brands inherit the master brand's essentials.", found: [] };
    }

    const rules = await loadRuleLines(data.brandId);
    const result = await analyzeGaps({ brandName: brand?.name ?? "the brand", rules });

    // Keep gaps the user already resolved; refresh the rest.
    await supabase.from("setup_gaps").delete().eq("brand_id", data.brandId).eq("resolved", false);
    if (result.gaps.length > 0) {
      await supabase.from("setup_gaps").insert(
        result.gaps.map((gap) => ({
          brand_id: data.brandId,
          topic: gap.topic,
          layer: gap.layer,
          gap_type: gap.gap_type,
          source_note: gap.source_note,
          why_it_matters: gap.why_it_matters,
        })),
      );
    }

    return result;
  });

/* --------------------------------------------------- Let CoBrand propose */

export const proposeForGap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ gapId: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAccess(context.supabase, "setup_gaps", data.gapId);
    const supabase = await db();
    const { data: gap } = await supabase
      .from("setup_gaps")
      .select("*")
      .eq("id", data.gapId)
      .maybeSingle();
    if (!gap) throw new Error("That gap could not be found.");

    const { data: brand } = await supabase
      .from("brands")
      .select("name")
      .eq("id", gap.brand_id)
      .maybeSingle();

    const rules = await loadRuleLines(gap.brand_id);
    const result = await proposeRule({
      brandName: brand?.name ?? "the brand",
      gap: `${gap.topic} (${gap.gap_type}) — ${gap.source_note ?? ""}`,
      rules,
    });

    if (!result.can_propose || !result.rule) {
      return { proposed: false, reason: result.reason };
    }

    await supabase.from("rules").insert({
      brand_id: gap.brand_id,
      layer: result.rule.layer,
      category: result.rule.rule_type,
      rule_code: await nextRuleCode(gap.brand_id, result.rule.rule_type),
      rule_type: result.rule.rule_type,
      label: result.rule.label,
      statement: result.rule.statement,
      value: result.rule.value ? { raw: result.rule.value } : {},
      severity: result.rule.severity,
      review_state: "inferred",
      status: "proposed",
      confidence: "low",
      source_citation: "Proposed by CoBrand from related brand context",
      source_evidence: result.rule.source_evidence,
    });

    return { proposed: true, reason: result.reason, label: result.rule.label };
  });

/** Option C for a checklist category that has no rules yet. */
export const proposeForCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ brandId: z.string(), category: z.string(), layer: z.string() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAccess(context.supabase, "brands", data.brandId);
    const supabase = await db();
    const { data: brand } = await supabase
      .from("brands")
      .select("name")
      .eq("id", data.brandId)
      .maybeSingle();
    const rules = await loadRuleLines(data.brandId);
    const topic = data.category.replace(/_/g, " ");
    const result = await proposeRule({
      brandName: brand?.name ?? "the brand",
      gap: `${topic} (missing) — no ${topic} rule exists in the ${data.layer} layer`,
      rules,
    });
    if (!result.can_propose || !result.rule) return { proposed: false, reason: result.reason };

    await supabase.from("rules").insert({
      brand_id: data.brandId,
      layer: data.layer,
      category: data.category,
      rule_code: await nextRuleCode(data.brandId, data.category),
      rule_type: result.rule.rule_type,
      label: result.rule.label,
      statement: result.rule.statement,
      value: result.rule.value ? { raw: result.rule.value } : {},
      severity: result.rule.severity,
      review_state: "inferred",
      status: "proposed",
      confidence: "low",
      confidence_score: 0.4,
      source_citation: "Proposed by CoBrand from related brand context",
      source_evidence: result.rule.source_evidence,
    });
    return { proposed: true, reason: result.reason, label: result.rule.label };
  });

/* --------------------------------------------------- Conversational edits */

export const draftEdits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ brandId: z.string(), request: z.string().min(2) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAccess(context.supabase, "brands", data.brandId);
    const rules = await loadRuleLines(data.brandId);
    return proposeEdits({ request: data.request, rules });
  });

const changeSchema = z.object({
  action: z.enum(["update", "add", "archive"]),
  rule_id: z.string().nullable(),
  label: z.string(),
  field: z.string(),
  old_value: z.string().nullable(),
  new_value: z.string(),
  layer: z.string(),
  rule_type: z.string(),
  severity: z.string(),
});

export const applyEdits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        brandId: z.string(),
        summary: z.string(),
        changes: z.array(changeSchema).min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAccess(context.supabase, "brands", data.brandId);
    const supabase = await db();

    for (const change of data.changes) {
      if (change.action === "add") {
        await supabase.from("rules").insert({
          brand_id: data.brandId,
          layer: change.layer,
          category: change.rule_type,
          rule_code: await nextRuleCode(data.brandId, change.rule_type),
          rule_type: change.rule_type,
          label: change.label,
          statement: change.new_value,
          value: change.field === "value" ? { raw: change.new_value } : {},
          severity: change.severity,
          review_state: "confirmed",
          status: "confirmed",
          confidence: "high",
          source_citation: "Added by the brand owner",
        });
        continue;
      }

      if (!change.rule_id) continue;

      if (change.action === "archive") {
        await supabase.from("rules").update({ status: "archived" }).eq("id", change.rule_id);
        continue;
      }

      await supabase
        .from("rules")
        .update({
          review_state: "confirmed",
          status: "confirmed",
          ...(change.field === "value" ? { value: { raw: change.new_value } } : {}),
          ...(change.field === "severity" ? { severity: change.new_value } : {}),
          ...(change.field === "label" ? { label: change.new_value } : {}),
          ...(!["value", "severity", "label"].includes(change.field)
            ? { statement: change.new_value }
            : {}),
        })
        .eq("id", change.rule_id);
    }

    const version = await bumpVersion(data.brandId, data.summary, "chat");
    return { version };
  });

/* ------------------------------------------------------- Structured edits */

export const saveRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ruleId: z.string(),
        brandId: z.string(),
        label: z.string(),
        statement: z.string(),
        value: z.string(),
        severity: z.string(),
        confirm: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAccess(context.supabase, "brands", data.brandId);
    const supabase = await db();
    await supabase
      .from("rules")
      .update({
        label: data.label,
        statement: data.statement,
        value: data.value ? { raw: data.value } : {},
        severity: data.severity,
        ...(data.confirm ? { status: "confirmed", review_state: "confirmed" } : {}),
      })
      .eq("id", data.ruleId);

    const version = await bumpVersion(
      data.brandId,
      `Edited "${data.label}"${data.confirm ? " and confirmed it" : ""}.`,
      "form",
    );
    return { version };
  });

export const confirmRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ ruleId: z.string(), brandId: z.string(), label: z.string() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAccess(context.supabase, "brands", data.brandId);
    const supabase = await db();
    await supabase
      .from("rules")
      .update({ status: "confirmed", review_state: "confirmed" })
      .eq("id", data.ruleId);
    await bumpVersion(data.brandId, `Confirmed "${data.label}" as brand truth.`, "form");
    return { ok: true };
  });

export const addManualRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        brandId: z.string(),
        gapId: z.string().nullable(),
        layer: z.string(),
        ruleType: z.string(),
        label: z.string().min(1),
        statement: z.string().min(1),
        value: z.string(),
        severity: z.string(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAccess(context.supabase, "brands", data.brandId);
    const supabase = await db();
    await supabase.from("rules").insert({
      brand_id: data.brandId,
      layer: data.layer,
      category: data.ruleType,
      rule_code: await nextRuleCode(data.brandId, data.ruleType),
      rule_type: data.ruleType,
      label: data.label,
      statement: data.statement,
      value: data.value ? { raw: data.value } : {},
      severity: data.severity,
      review_state: "confirmed",
      status: "confirmed",
      confidence: "high",
      source_citation: "Defined by the brand owner",
    });
    if (data.gapId) {
      await supabase.from("setup_gaps").update({ resolved: true }).eq("id", data.gapId);
    }
    await bumpVersion(data.brandId, `Defined "${data.label}" manually.`, "form");
    return { ok: true };
  });

/* --------------------------------------------- Creative brief pre-fill */

export const readBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ brief: z.string().min(10) }).parse(input))
  .handler(async ({ data }) => prefillContext({ brief: data.brief }));
