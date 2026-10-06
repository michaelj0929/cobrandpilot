# Brand System: 5 layers + structured rules

## 1. Smaller brand picker
Replace the large boxed picker (Brand System and Uploads) with a compact, subtle row:
- Small pill for the master brand, then a thin "›" and smaller pills for each sub-brand / product line.
- The pill you're viewing is filled; the others are hairline outlined. No surrounding card, no big heading — one small label ("Brand" / "Uploading to").

## 2. Five layer toggles at the top of Brand System
Replace Foundation / Identity / Execution with five toggles, shown first on the page (above Brand Check):

```text
[ Intent ] [ Recognition ] [ Execution ] [ Context ] [ Campaign ]
```

| Layer | Question | Categories |
|---|---|---|
| Intent | What does the brand mean? | purpose, promise, positioning, audiences, audience needs, category, differentiators, values, value propositions, proof points, reasons to believe |
| Recognition | What makes it recognizable? | logo, logo variants, clear space, minimum size, primary/secondary colours, colour roles, typography, type hierarchy, voice traits, visual signatures |
| Execution | How does the brand get made? | spacing, grid, alignment, layout, imagery, photography, illustration, iconography, graphic devices, borders, shadows, motion, filter treatments, CTA patterns, copy patterns, claims, terminology |
| Context | How does it behave differently? | channel, format, audience, market, language, funnel stage, objective, product, use case |
| Campaign | What is layered on temporarily? | campaign name, message, claims, palette, typography, visual devices, templates, start date, expiry date |

Each toggle shows its question underneath and a count of rules. Within a layer, rules are grouped by category; colours still show as swatches and fonts as type specimens.

## 3. Rules stored as "brand code"
Every uploaded document is turned into structured rule records like your example, instead of one-line sentences:

```text
rule_id: LOGO-004      layer: recognition    category: logo
rule: Maintain clear space equal to the height of the symbol.
severity: must   scope: [global]   time: permanent   authority: brand_owner
source_document: Master Brand Guidelines   source_page: 22
confidence: 0.98   status: confirmed
```

- Each rule card shows a readable summary; opening it shows the full structured record (with a "View as code" toggle showing the record exactly like your example).
- Rule IDs are generated per category (LOGO-001, COLOR-003, VOICE-002…), stable once assigned.
- Campaign rules carry start and expiry dates; Creative Review ignores expired campaign rules.
- Creative Review findings cite the rule ID.

## 4. Existing data
Existing rules move automatically: Foundation → Intent, Identity → Recognition, Execution → Execution (campaign-scoped ones → Campaign). The Nike sample gets rule IDs, categories, source page and numeric confidence filled in. Re-uploading or re-building will produce the new format going forward.

## Technical details
- Migration (additive): `rules` gains `rule_code text`, `category text`, `scope_tags text[] default '{global}'`, `source_document text`, `source_page int`, `confidence_score numeric`, `starts_at date`, `expires_at date`; unique index on (brand_id, rule_code). Backfill `layer` values (foundation→intent, identity→recognition, time_scope='campaign'→campaign) and `category` from `rule_type`. Old text `confidence` kept and commented as deprecated.
- `LAYERS` constant, `LAYER_LABEL`, `LAYER_BLURB`, and a new `LAYER_CATEGORIES` map in `cobrand-client.ts`; Agent B schema/prompt rewritten to emit category (enum per layer), scope array, source_document, source_page, confidence 0–1, campaign dates. Server assigns `rule_code` as `<CATEGORY_PREFIX>-<nnn>` on insert.
- Gap analysis (Agent C), edit drafting, readiness and review agents updated to the five layers; review prompt lists rule codes and filters expired campaign rules.
- `brand-scope.tsx` restyled to compact pills; `brain.tsx` layer tabs and RuleCard (structured detail + code view) updated; `setup-gaps.tsx` uses new layer labels.
