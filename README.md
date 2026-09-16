# CoBrand

CoBrand turns a company's scattered brand guidelines (PDFs, decks, images) into a single structured, editable **Brand Model** — and lets anyone check whether a piece of copy or a visual asset is on-brand, with a score, specific violations, and a suggested fix for each one.

## The problem

Brand guidelines live as static PDFs or decks that go stale immediately. Checking whether an asset is on-brand is a manual, subjective, after-the-fact review — teams either skip it (inconsistency) or catch it too late (rework, slow approvals). Most tools that claim to solve this reduce a brand to a color palette and a logo file, with no way to explain *why* something is off-brand or adapt that judgment to context.

## What it does (v1)

- **Ingests** existing brand materials (PDFs, decks, images) and extracts a structured Brand Model — explicit, atomic rules with severity and source citations, not a prose summary.
- **Organizes the model in three layers** — Foundation (purpose, positioning, audience), Identity (colors, typography, logo, voice), and Execution (exact tokens, banned phrases, do/don't examples) — browsable as a first-class experience, not a settings page.
- **Flags gaps honestly**: every field is marked Confirmed, Inferred, or Missing, and the system reports contextual "Brand Readiness" for a specific creative before scoring it — never silently assuming the model is complete.
- **Validates copy and visual assets** against the model in three passes (objective, interpretive, contextual), returning an overall score, a per-dimension breakdown, and violations with severity, confidence, a plain-language explanation, and a suggested fix.
- **Shows visual feedback as numbered pins** directly on the uploaded asset, paired with a written findings panel.

## What v1 deliberately doesn't do

No live design-tool plugins (Figma/Adobe/Canva), no auto-updating guidelines from approved work, no external sharing/partner hub, no multi-brand support, no auto-applying fixes. See the [PRD](link-to-prd) for the full scope and roadmap.

## Status

Pilot Stage 1 — ingest, structure, gap-check, and creative review. See the [PRD](link-to-prd) for detailed requirements.
