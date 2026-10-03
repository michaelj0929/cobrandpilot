# CoBrand — Pilot Stage 1 build plan

A working prototype of the full PRD: upload brand material, get a structured Brand Model you can review and edit, see what's missing, then check any brief, copy, or asset against the brand and get scored, specific feedback. No login — one workspace with one master brand (plus optional sub-brands and product lines), one brand model per brand, everything saved.

## What gets built

### 1. Brands & upload
- One master brand per workspace; create it on first run (name, category, type, market, description), then add sub-brands and product lines under it (see 1a).
- Drag-and-drop upload of PDF, PPTX, DOCX, PNG/JPG/WEBP, SVG, plus pasted text. Several files per pass, capped at 25MB each / 10 per pass.
- Each file gets an auto-suggested classification (master guideline, messaging, campaign, approved creative, design system, product messaging, channel, other) that the user can override.
- Files stored in cloud storage; every extracted rule keeps a citation back to file + page/section.

### 1a. Master brand, sub-brands and product lines (added 2026-10-02)
- **One master brand per workspace.** First run asks for the master brand, then prompts the user to upload all their brand documents. Uploads are stored as queued; a "Build brand system" step then reads every pending document in turn and runs one gap check. The master brand system is the knowledge base every check runs against. When accounts are added, the rule becomes one master brand per account.
- **Sub-brands and product lines** sit directly under the master (no deeper nesting). Each has its own uploads, rules, Brand Brain and versions. Their material is conflict-checked against the master's confirmed rules as well as their own, and they skip the essential-checklist gap check because the master covers it.
- **Checking content** always runs on the master brand. The user picks any number of sub-brands / product lines whose guidelines also apply. The context resolver and reviewer receive master rules plus the selected sets, each line tagged with its origin. Sub-brand and product-line rules sit at the Product level of the priority order: they override master Should/Can rules where they conflict, and a master Must always wins. Each check records which sets it used.
- **Data:** `brands.parent_brand_id` and `brands.kind` (master / sub_brand / product_line), a unique index allowing one master brand, a trigger keeping sub-brands directly under the master, and `validation_checks.sub_brand_ids`.

### 2. Extraction into the Brand Model
Separate AI steps, each saved and inspectable:
- **Classifier** — what kind of material is this.
- **Extractor** — pulls atomic rule objects (colors, type, logo rules, layout, voice traits, tone, banned phrases, reading level, core messaging, foundation statements, do/don't pairs). Each rule carries severity (Must/Should/Can), scope, time, authority, layer, review state (Confirmed / Inferred / Missing), lifecycle status, and a source citation.
- **Conflict resolver** — flags contradictions with already-confirmed rules instead of overwriting them.
- **Gap analyzer** — runs the essential checklist and records gaps as Missing or Vague. Nothing vague is ever upgraded into a fake precise rule.
- Setup summary shown prominently after ingestion: found / too vague / missing.

### 3. Brand Brain (explore + edit)
- Three zoom levels: Foundation → Identity → Execution, navigated as a drill-in with a consistent way back out and lateral jumps between sections.
- Identity and Execution views render in the brand's own extracted colors and fonts; forms and review results stay neutral so they stay unambiguous.
- Every field badged Confirmed / Inferred / Missing, with its source citation and a confirm/edit action.
- Structured editing (fields) and conversational editing ("drop the orange accent, use navy") — chat proposes a field-level diff you approve before saving.
- Gap list persists visibly until resolved, with three routes to close each one: upload more, define manually, or "let CoBrand propose" — proposals are only drafted when you click, and land as Proposed until accepted.

### 4. Review a creative
- Intake accepts anything: a written brief, pasted or uploaded copy, an image (PNG/JPG/WEBP), a PDF or deck export — alone or together, with the brief text optional alongside an asset.
- Context fields: format, objective, audience, plus optional market, product, campaign, key message. Anything the brief text already states is pre-filled by the system for confirmation.
- **Readiness** step: before scoring, CoBrand says what knowledge this specific review needs, what it has, what it's missing, a readiness percentage, and plainly what it can and can't judge confidently.
- **Context resolver** picks only the rules whose scope/time/authority apply, using the priority order Campaign → Channel → Product → Masterbrand, with masterbrand Must rules never overridable.
- **Reviewer** runs three passes: objective, interpretive, contextual.
- **Recommendation writer** turns findings into per-finding severity, confidence, plain-language why, source citation, and a concrete fix.

### 5. Review results
- Top-line label plus dimension breakdown: recognition, layout, messaging, channel fit, campaign fit.
- Visual assets: original image on the left with numbered pins (stored as percentage coordinates, so they stay correct at any size), findings panel on the right.
- Copy/brief: findings anchored to the quoted text they refer to.
- Click any finding for rule detail: the rule, its source, why it applied here, the recommendation.
- Re-submit to re-check.

### 6. Versioning & history
- Every confirmed edit creates a new Brand Model version with timestamp and diff summary; previous versions viewable.
- Each review records the version it was judged against.
- Rule lifecycle: Detect → Proposed → Confirmed → Superseded → Archived. Only Confirmed rules are fully load-bearing for scoring; Proposed/Inferred ones are shown but flagged.

### 7. Dashboard
Brand at a glance (key tokens, voice summary), unresolved gaps up front, recent reviews and scores, entry points to upload, edit, and run a check.

## Technical notes

- Backend on Lovable Cloud: Postgres tables for brands, source_files, rules (single polymorphic rule table with layer/type/severity/scope/time/authority/status/citation), examples, context_tags, setup_gaps, brand_versions, validation_checks, findings. Storage buckets for source files and submitted creatives.
- No auth in this build; data keyed to a single implicit workspace, structured so accounts can be added later without reshaping tables.
- AI through the Lovable AI Gateway as seven discrete calls (classifier, extractor, conflict resolver, gap analyzer, context resolver, reviewer, recommendation writer), each with a strict JSON schema. PDFs and images go to the model natively; DOCX/PPTX are text-extracted first; SVG parsed for colors and treated as a logo asset.
- Ingestion runs as a background job with per-file progress, since large decks take a while.
- Server functions under TanStack Start; uploads and long AI work never block the page.

## Out of scope (per the PRD)
No Figma/Adobe/Canva plugins, no DAM or CMS sync, no auto-applied fixes, no generated annotated images, no multi-brand roles (sub-brands share the workspace; there are no per-brand permissions), no auto-evolving guidelines, no video validation.

## Suggested order
1. Brands, upload, storage, schema.
2. Extraction pipeline + setup summary.
3. Brand Brain explore/edit + gaps + versioning.
4. Creative intake, readiness, review, results.
5. Dashboard and brand-themed styling pass.
