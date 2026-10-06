# Brand System: 3 layers + structured rules for Creative Review

## 1. Smaller brand picker
Replace the large boxed picker (Brand System and Uploads) with a compact, subtle row:
- Small pill for the master brand, then a thin "›" and smaller pills for each sub-brand / product line.
- The pill you're viewing is filled; the others are hairline outlined. No surrounding card, one small label ("Brand" / "Uploading to").

## 2. Three layer toggles at the top of Brand System
Replace Foundation / Identity / Execution with three toggles, shown first on the page (above Brand Check):

```text
[ Intent ] [ Recognition ] [ Execution ]
```

| Layer | Question | Categories |
|---|---|---|
| Intent | What does the brand mean? | purpose, promise, positioning, audiences, audience needs, category, differentiators, values, value propositions, proof points, reasons to believe |
| Recognition | What makes it recognizable? | logo, logo variants, clear space, minimum size, primary/secondary colours, colour roles, typography, type hierarchy, voice traits, visual signatures |
| Execution | How does the brand get made? | spacing, grid, alignment, layout, imagery, photography, illustration, iconography, graphic devices, borders, shadows, motion, filter treatments, CTA patterns, copy patterns, claims, terminology |

Each toggle shows its question and a rule count. Within a layer, rules are grouped by category; colours still show as swatches and fonts as type specimens. Rule cards stay readable (no code view).

## 3. Rules stored as structured records (behind the scenes)
Every uploaded document becomes structured rule records like your example:

```text
rule_id: LOGO-004   layer: recognition   category: logo
rule: Maintain clear space equal to the height of the symbol.
severity: must   scope: [global]   time: permanent   authority: brand_owner
source_document: Master Brand Guidelines   source_page: 22
confidence: 0.98   status: confirmed
```

Creative Review uses exactly these records: the AI receives every applicable rule with its ID, category, severity and scope, checks the creative against each one, and every finding cites the rule ID it was checked against (shown on the review results). Rules marked "must" weigh most in the score.

## 4. Existing data
Existing rules move automatically: Foundation → Intent, Identity → Recognition, Execution → Execution. The Nike sample gets rule IDs, categories, source page and numeric confidence filled in. New uploads produce the new format.

## Technical details
- Migration (additive): `rules` gains `rule_code text`, `category text`, `scope_tags text[] default '{global}'`, `source_document text`, `source_page int`, `confidence_score numeric`; unique index on (brand_id, rule_code). Backfill `layer` (foundation→intent, identity→recognition) and `category` from `rule_type`. Old text `confidence` commented as deprecated.
- `LAYERS`, `LAYER_LABEL`, `LAYER_BLURB`, new `LAYER_CATEGORIES` in `cobrand-client.ts`; Agent B schema/prompt emits category (enum per layer), scope array, source_document, source_page, confidence 0–1. Server assigns `rule_code` as `<CATEGORY_PREFIX>-<nnn>` on insert.
- Review agent receives rules as a JSON array of these records and must return `rule_code` per finding; findings store the linked `rule_id`. Gap analysis, edit drafting and readiness agents updated to the three layers.
- `brand-scope.tsx` restyled to compact pills; `brain.tsx` layer tabs and RuleCard detail updated; `setup-gaps.tsx` uses new layer labels.
