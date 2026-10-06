# Brand Check page

## What changes
- **Brand System page:** a "Brand Check" button sits at the top (next to the brand switcher, with a small count of missing items). The Brand Check list at the bottom of the page is removed.
- **New Brand Check page** (opens from that button; a "Back to Brand System" link returns you). Works for the master brand and for each sub-brand / product line.

## Brand Check page layout

```text
Brand Check — Nike                          [Re-check]
 12 complete · 3 inferred · 5 missing        (progress bar)

 MISSING (flagged at top)
  ! CTA rules not found
    [A Upload more material] [B Define manually] [C Let CoBrand propose]
  ! Paid social guidance not found   ...

 [ Intent ] [ Recognition ] [ Execution ]     (layer tabs)
  ✓ Positioning        Complete from source — Guidelines p.5
  ~ Voice traits       Inferred — "voice appears clear / optimistic / expert" (p.27)
                       [Confirm] [Edit]
  ! Proof points       Missing   [A] [B] [C]
```

Every checklist item in each layer (the categories already defined: purpose, positioning, logo clear space, primary colours, CTA patterns, claims…) gets one status:
- **Complete** (check mark) — at least one confirmed rule from your documents; shows the source document and page.
- **Inferred** — rules exist but CoBrand read them between the lines; shows the inferred wording and source evidence with page. Options: **Confirm** (becomes brand truth) or **Edit** (inline edit, then save as confirmed).
- **Missing** — nothing found, or too vague to check against. Includes the specific gaps CoBrand's gap check reports (e.g. "Product messaging architecture not found", "Paid social guidance not found"). Three options:
  - **A — Upload more material:** goes to Uploads with this brand pre-selected.
  - **B — Define manually:** inline form (rule wording, optional value, must/should/can) saved as a confirmed rule in that category.
  - **C — Let CoBrand propose:** drafts a candidate rule from related brand content; it appears as Inferred for you to confirm or edit. If there is no honest basis, it says so.

All missing items are also gathered at the top of the page so you see them first.

## Technical details
- New route `src/routes/_authenticated/brands.$brandId.check.tsx` (head meta "Brand Check — CoBrand"), uses `BrandScopePicker` with `to="/brands/$brandId/check"` (picker's `to` union extended).
- Status computed client-side per category from `listRules` (confirmed → complete; only inferred/proposed → inferred) merged with open `setup_gaps` (gap rows always shown as missing; categories with no rules and no gap show as missing too). Gaps gain an optional category mapping by matching gap topic/layer; unmatched gaps listed under their layer as extra missing items.
- Reuse existing server functions: `runGapCheck` (Re-check), `proposeForGap` (C; for category-only items without a gap row, a new `proposeForCategory` server fn wraps the same proposal agent), `addManualRule` (B; now accepts `category`), `confirmRule` / `saveRule` (Confirm / Edit).
- `setup-gaps.tsx` logic folds into the new page; remove the panel from `brands.$brandId.brain.tsx` and add the button there.
- Uploads link passes the brand id so the picker is pre-selected (`/brands/$brandId`).
