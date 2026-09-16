import { z } from "zod";
import { runAgent, type AgentFile } from "./ai-gateway.server";

export const LAYERS = ["foundation", "identity", "execution"] as const;
export const RULE_TYPES = [
  "foundation",
  "color",
  "typography",
  "logo",
  "layout",
  "imagery",
  "voice_trait",
  "tone",
  "banned_phrase",
  "reading_level",
  "core_messaging",
  "cta",
  "terminology",
  "other",
] as const;

export const CLASSIFICATIONS = [
  "Master Brand Guideline",
  "Messaging/Strategy",
  "Campaign Guideline",
  "Approved Creatives",
  "Design System/UI",
  "Product Messaging",
  "Channel Guidelines",
  "Other",
] as const;

const severity = z.enum(["must", "should", "can"]);
const scope = z.enum(["global", "region", "channel", "audience", "product"]);
const timeScope = z.enum(["permanent", "campaign", "temporary", "expiring"]);
const confidence = z.enum(["high", "medium", "low"]);

const SHARED_RULES = `You are part of CoBrand, a brand-operations system.
Never invent brand truth. If the source does not say something, say it is missing instead of guessing.
Never turn a vague descriptive sentence into a precise-sounding rule. A vague statement is recorded as vague.
Every rule must be atomic, checkable and carry its own metadata.`;

/* ---------------------------------------------------------------- Agent A */

const classificationSchema = z.object({
  classification: z.enum(CLASSIFICATIONS),
  rationale: z.string(),
});

export function classifyDocument(input: {
  fileName: string;
  text: string | null;
  file: AgentFile | null;
}) {
  return runAgent({
    schema: classificationSchema,
    effort: "low",
    system: `${SHARED_RULES}\nYou are Agent A, the document classifier. Decide what kind of brand material this file is.`,
    prompt: `File name: ${input.fileName}\n\n${
      input.text ? `Content:\n${input.text.slice(0, 20000)}` : "The file itself is attached."
    }`,
    ...(input.file ? { files: [input.file] } : {}),
    fallback: { classification: "Other" as const, rationale: "Could not be classified." },
  });
}

/* ---------------------------------------------------------------- Agent B */

const extractedRule = z.object({
  layer: z.enum(LAYERS),
  rule_type: z.enum(RULE_TYPES),
  label: z.string(),
  statement: z.string(),
  value: z.string().nullable(),
  severity,
  scope,
  time_scope: timeScope,
  authority: z.string().nullable(),
  review_state: z.enum(["confirmed", "inferred"]),
  confidence,
  source_citation: z.string(),
  source_evidence: z.string().nullable(),
  context: z.object({
    channel: z.string().nullable(),
    format: z.string().nullable(),
    audience: z.string().nullable(),
    market: z.string().nullable(),
    funnel_stage: z.string().nullable(),
    objective: z.string().nullable(),
    product: z.string().nullable(),
    campaign: z.string().nullable(),
  }),
  examples: z.array(
    z.object({
      example_type: z.enum(["do", "dont"]),
      description: z.string(),
      source_ref: z.string().nullable(),
    }),
  ),
});

export type ExtractedRule = z.infer<typeof extractedRule>;

const extractionSchema = z.object({
  rules: z.array(extractedRule),
  notes: z.string(),
});

export function extractRules(input: {
  brandName: string;
  fileName: string;
  classification: string;
  text: string | null;
  file: AgentFile | null;
}) {
  return runAgent({
    schema: extractionSchema,
    effort: "high",
    system: `${SHARED_RULES}
You are Agent B, the brand extractor. Transform the source into explicit, atomic rule objects — never a summary.

Rules to follow:
- layer: foundation = purpose/positioning/audience/differentiators/values/proof; identity = logo, colour roles, typography system, voice traits, visual signatures; execution = exact tokens, spacing, grids, imagery treatment, banned phrases, reading level, CTA and copy patterns, do/don't examples.
- value: the concrete machine-usable value where one exists (a hex like "#1A1A1A", a font family, "1x symbol height", "grade 8"), otherwise null.
- review_state: "confirmed" only when the source states it directly. "inferred" when you read between the lines — then source_evidence must quote the evidence.
- severity: must = non-negotiable; should = strong default; can = optional.
- source_citation: always a precise pointer like "Master Brand Guideline, p.12, Logo usage" or "Slide 4 — Voice".
- Add a do/don't example wherever the source contains enough evidence for one.
- Extract every colour role, every type role, every logo variant and rule, every voice trait, every banned phrase separately — one rule object each.`,
    prompt: `Brand: ${input.brandName}
Source file: ${input.fileName}
Classified as: ${input.classification}

${input.text ? `Content:\n${input.text.slice(0, 120000)}` : "The source file itself is attached — read every page."}`,
    ...(input.file ? { files: [input.file] } : {}),
    fallback: { rules: [], notes: "Nothing could be extracted from this source." },
  });
}

/* ---------------------------------------------------------------- Agent C */

const conflictSchema = z.object({
  conflicts: z.array(
    z.object({
      incoming_label: z.string(),
      existing_label: z.string(),
      note: z.string(),
    }),
  ),
});

export function resolveConflicts(input: { existing: string; incoming: string }) {
  return runAgent({
    schema: conflictSchema,
    effort: "low",
    system: `${SHARED_RULES}\nYou are Agent C, the conflict resolver. Flag contradictions between newly extracted rules and already-confirmed brand truth. Never silently overwrite. Only report genuine contradictions, not additions.`,
    prompt: `Already confirmed rules:\n${input.existing || "(none)"}\n\nNewly extracted rules:\n${input.incoming}`,
    fallback: { conflicts: [] },
  });
}

/* ---------------------------------------------------------------- Agent D */

const gapSchema = z.object({
  gaps: z.array(
    z.object({
      topic: z.string(),
      layer: z.enum(LAYERS),
      gap_type: z.enum(["missing", "vague"]),
      source_note: z.string(),
      why_it_matters: z.string(),
    }),
  ),
  summary: z.string(),
  found: z.array(z.string()),
});

export function analyzeGaps(input: { brandName: string; rules: string }) {
  return runAgent({
    schema: gapSchema,
    effort: "medium",
    system: `${SHARED_RULES}
You are Agent D, the gap analyser. Check the brand model against CoBrand's essential checklist:
Foundation — positioning statement, primary audience, at least one core differentiator.
Identity — at least one primary colour role, a heading and a body typography role, a primary logo variant with a usage rule, at least three voice traits.
Execution — at least one do/don't example pair, a reading-level target or equivalent voice guardrail, and either a banned-phrases list or an explicit confirmation that none exist.
Report "missing" when nothing was found and "vague" when something exists but is not specific enough to check creative against. Never upgrade a vague item into a precise one.`,
    prompt: `Brand: ${input.brandName}\n\nCurrent brand model:\n${input.rules || "(empty)"}`,
    fallback: { gaps: [], summary: "Gap check unavailable.", found: [] },
  });
}

/* ------------------------------------------------- Agent D2: propose a rule */

const proposalSchema = z.object({
  can_propose: z.boolean(),
  reason: z.string(),
  rule: z
    .object({
      layer: z.enum(LAYERS),
      rule_type: z.enum(RULE_TYPES),
      label: z.string(),
      statement: z.string(),
      value: z.string().nullable(),
      severity,
      source_evidence: z.string(),
    })
    .nullable(),
});

export function proposeRule(input: { brandName: string; gap: string; rules: string }) {
  return runAgent({
    schema: proposalSchema,
    effort: "medium",
    system: `${SHARED_RULES}
You are filling a specific gap on request. Draft ONE candidate rule from adjacent context that already exists in the brand model. It enters as "Proposed" and is not brand truth until a human confirms it. If the existing model gives you no honest basis, set can_propose to false rather than inventing something.`,
    prompt: `Brand: ${input.brandName}\nGap to fill: ${input.gap}\n\nExisting brand model:\n${input.rules}`,
    fallback: { can_propose: false, reason: "No basis to propose a rule.", rule: null },
  });
}

/* ------------------------------------------- Conversational edit to a diff */

const editSchema = z.object({
  understood: z.string(),
  changes: z.array(
    z.object({
      action: z.enum(["update", "add", "archive"]),
      rule_id: z.string().nullable(),
      label: z.string(),
      field: z.string(),
      old_value: z.string().nullable(),
      new_value: z.string(),
      layer: z.enum(LAYERS),
      rule_type: z.enum(RULE_TYPES),
      severity,
    }),
  ),
  question: z.string().nullable(),
});

export type ProposedEdits = z.infer<typeof editSchema>;

export function proposeEdits(input: { request: string; rules: string }) {
  return runAgent({
    schema: editSchema,
    effort: "medium",
    system: `${SHARED_RULES}
You turn a plain-language edit request into a precise, field-level diff against the brand model. Never apply anything — you only propose.
Use action "update" with the exact rule_id from the list for an existing rule, "add" for something new (rule_id null), "archive" to retire a rule.
For "update" the field is one of: statement, value, severity, label. If the request is ambiguous, still propose your best reading and put the clarification in "question".`,
    prompt: `Edit request: ${input.request}\n\nCurrent brand model (id | layer | type | label | statement | value | severity):\n${input.rules}`,
    fallback: { understood: "Could not interpret that request.", changes: [], question: null },
  });
}

/* ---------------------------------------------------------------- Agent E */

const contextSchema = z.object({
  applicable_rule_ids: z.array(z.string()),
  excluded_rule_ids: z.array(z.string()),
  priority_notes: z.string(),
  readiness: z.object({
    score: z.number(),
    needed: z.array(z.string()),
    available: z.array(z.string()),
    missing: z.array(z.string()),
    can_do: z.string(),
    cannot_do: z.string(),
  }),
  rule_reasons: z.array(z.object({ rule_id: z.string(), applies_because: z.string() })),
});

export type ContextResolution = z.infer<typeof contextSchema>;

export function resolveContext(input: {
  brandName: string;
  context: string;
  creativeSummary: string;
  rules: string;
}) {
  return runAgent({
    schema: contextSchema,
    effort: "medium",
    system: `${SHARED_RULES}
You are Agent E, the context resolver. Two jobs:
1. Select only the rules that actually apply to this creative in its stated context. Resolve conflicts with the hierarchy Campaign > Channel/Context > Product > Masterbrand — except a masterbrand rule with severity "must" can never be overridden.
2. Report brand readiness FOR THIS REVIEW: what knowledge this specific review needs, what the model has, what is missing, a 0-100 score, and plainly what you can and cannot judge confidently. A missing area only counts against readiness if this creative actually needs it.`,
    prompt: `Brand: ${input.brandName}
Creative context: ${input.context}
Creative: ${input.creativeSummary}

Brand model rules (id | layer | type | label | statement | value | severity | scope | time | status | context tags):
${input.rules}`,
    fallback: {
      applicable_rule_ids: [],
      excluded_rule_ids: [],
      priority_notes: "",
      readiness: {
        score: 0,
        needed: [],
        available: [],
        missing: [],
        can_do: "",
        cannot_do: "Readiness could not be assessed.",
      },
      rule_reasons: [],
    },
  });
}

/* ---------------------------------------------------------------- Agent F */

const reviewSchema = z.object({
  observations: z.array(
    z.object({
      pass_name: z.enum(["objective", "interpretive", "contextual"]),
      rule_id: z.string().nullable(),
      rule_statement: z.string(),
      title: z.string(),
      dimension: z.enum(["recognition", "layout", "messaging", "channel_fit", "campaign_fit"]),
      status: z.enum(["issue", "pass"]),
      severity,
      confidence,
      finding: z.string(),
      evidence: z.string(),
      quote: z.string().nullable(),
      pin_x: z.number().nullable(),
      pin_y: z.number().nullable(),
    }),
  ),
});

export function reviewCreative(input: {
  brandName: string;
  context: string;
  rules: string;
  copyText: string | null;
  briefText: string | null;
  file: AgentFile | null;
}) {
  return runAgent({
    schema: reviewSchema,
    effort: "high",
    system: `${SHARED_RULES}
You are Agent F, the creative reviewer. Work in three passes, exactly like a human reviewer:
1. Objective (mechanical): logo presence and variant, colour match, typography, contrast, aspect ratio, text density, alignment, safe area.
2. Interpretive: imagery feel, hierarchy, composition, density, tone, messaging, CTA choice, audience relevance.
3. Contextual: fit with the stated channel, objective, audience, market, product and campaign.
Only judge against the rules given to you. Never invent a rule.
Report both issues and notable passes. Set confidence honestly and separately from severity.
For a visual asset, give pin_x and pin_y as PERCENTAGES (0-100) of the image width and height pointing at the exact spot the finding refers to. For copy, quote the exact phrase instead and leave pins null.`,
    prompt: `Brand: ${input.brandName}
Creative context: ${input.context}

Applicable rules (id | statement | severity | source):
${input.rules}

${input.briefText ? `Creative brief provided by the user:\n${input.briefText}\n` : ""}
${input.copyText ? `Copy submitted for review:\n${input.copyText}\n` : ""}
${input.file ? "The creative asset itself is attached." : ""}`,
    ...(input.file ? { files: [input.file] } : {}),
    fallback: { observations: [] },
  });
}

/* ---------------------------------------------------------------- Agent G */

const recommendationSchema = z.object({
  label: z.string(),
  score: z.number(),
  summary: z.string(),
  dimension_scores: z.object({
    recognition: z.number(),
    layout: z.number(),
    messaging: z.number(),
    channel_fit: z.number(),
    campaign_fit: z.number(),
  }),
  findings: z.array(
    z.object({
      number: z.number(),
      rule_id: z.string().nullable(),
      title: z.string(),
      pass_name: z.enum(["objective", "interpretive", "contextual"]),
      dimension: z.string(),
      severity,
      confidence,
      status: z.enum(["issue", "pass"]),
      explanation: z.string(),
      why_it_matters: z.string(),
      rule_statement: z.string(),
      source_citation: z.string(),
      suggested_fix: z.string(),
      quote: z.string().nullable(),
      pin_x: z.number().nullable(),
      pin_y: z.number().nullable(),
    }),
  ),
});

export type ReviewOutput = z.infer<typeof recommendationSchema>;

export function writeRecommendations(input: {
  brandName: string;
  context: string;
  observations: string;
  readiness: string;
  ruleReasons: string;
}) {
  return runAgent({
    schema: recommendationSchema,
    effort: "medium",
    system: `${SHARED_RULES}
You are Agent G, the recommendation writer. Turn raw observations into creator-ready guidance.
- Number the findings starting at 1, issues first, most severe first.
- Each finding: what is wrong in plain language, why it matters, the rule it breaks, the source citation, and ONE concrete fix the creator can apply by hand (e.g. "move the logo 18px inward", "replace 'best-in-class' with 'proven'"). Never tell them to run a tool.
- Score each dimension 0-100 and give an overall 0-100 score plus a short label such as "Strong", "Mixed" or "Off-brand".
- Lower confidence in dimensions the readiness report says cannot be judged confidently, and say so in the summary.
- Keep pins and quotes exactly as given.`,
    prompt: `Brand: ${input.brandName}
Creative context: ${input.context}
Readiness for this review: ${input.readiness}
Why each rule applied: ${input.ruleReasons}

Observations from the three review passes:
${input.observations}`,
    fallback: {
      label: "Unavailable",
      score: 0,
      summary: "The review could not be completed.",
      dimension_scores: {
        recognition: 0,
        layout: 0,
        messaging: 0,
        channel_fit: 0,
        campaign_fit: 0,
      },
      findings: [],
    },
  });
}

/* ------------------------------------------- Creative context pre-fill */

const contextPrefillSchema = z.object({
  format: z.string().nullable(),
  objective: z.string().nullable(),
  audience: z.string().nullable(),
  market: z.string().nullable(),
  product: z.string().nullable(),
  campaign: z.string().nullable(),
  key_message: z.string().nullable(),
});

export function prefillContext(input: { brief: string }) {
  return runAgent({
    schema: contextPrefillSchema,
    effort: "low",
    system: `${SHARED_RULES}\nRead the creative brief and pull out only what it actually states. Leave anything it does not state as null. Format should be one of: paid social, organic social, display, email, web, landing page, presentation, sales collateral, event, OOH, packaging, other.`,
    prompt: input.brief.slice(0, 20000),
    fallback: {
      format: null,
      objective: null,
      audience: null,
      market: null,
      product: null,
      campaign: null,
      key_message: null,
    },
  });
}
