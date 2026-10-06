# Clearer brand switcher and a Brand status panel

## 1. Brand switcher (Brand System, Brand Check, Uploads)

Swap the single row of pills for a small, quiet "brand family" panel that shows the structure:

```text
 VIEWING
 ┌──────────────────────────────────────────────────────────────┐
 │  [● Nike]  Master brand                                        │
 │   │                                                            │
 │   ├─ Sub-brands     [Jordan] [Nike SB]                         │
 │   └─ Product lines  [Pegasus] [Air Max]                        │
 └──────────────────────────────────────────────────────────────┘
```

- The master brand sits on its own line with a small "Master brand" label.
- Sub-brands and product lines sit in two labelled rows underneath, joined to the master by a thin connecting line, so the hierarchy is clear at a glance.
- The selected brand is filled dark; the rest are thin outlined chips at the current small size (nothing bigger than today).
- A row only appears if it has something in it. If there are no sub-brands or product lines, the panel shrinks to the master brand plus a quiet "No sub-brands yet" note.
- When you're on a sub-brand or product line, a one-line note underneath says "Built on Nike · Nike's Must rules still apply" and links back to the master brand.
- Selecting any chip keeps you on the same page (Brand System stays Brand System, and so on).

## 2. Brand status + Brand Check grouped in a light blue panel

Brand status and the Brand Check button move into one light blue card at the top right of the page header, so the button clearly belongs to the status:

```text
 ┌──────────────────────────────┐
 │ Brand status                  │
 │ 72% confirmed                 │
 │ ▓▓▓▓▓▓▓▓▓▓▓░░░░               │
 │ 16 rules · 12 confirmed · 4 to review │
 │ ───────────────────────────── │
 │ 3 items missing               │
 │ [ Run Brand Check  → ]        │
 └──────────────────────────────┘
```

- A large confirmed percentage gives one clear headline number, with the progress bar and counts beneath it.
- A hairline divider, then the missing-item count (in red if anything is missing, "Nothing missing" with a check mark if not) and a full-width "Run Brand Check" button.
- Both sit inside the light blue tint so they read as one unit. On small screens the card stacks under the title at full width.

## Technical details

- `src/components/brand-scope.tsx`: rewrite `BrandScopePicker` as a hairline card. Group `subBrands` by `kind` (`sub_brand` / `product_line`) and give each group a label from `BRAND_KIND_LABEL`, with a left-border connector. Keep the same props and `to` union; add the "Built on {master}" line when `brandId !== master.id`.
- New `BrandStatusCard` (in `src/components/brand-status.tsx`) takes `brandId`, rule counts and the open gap count. It uses `bg-brand-tint`, the existing `Meter` styling and `Button` with a `Link` to `/brands/$brandId/check`.
- `brands.$brandId.brain.tsx`: replace the inline `statusBlock` with `<BrandStatusCard>`, passed via `PageHead actions` with `actionsAlign="start"`.
- Only semantic tokens; no new colours. Check the Nike master and a sub-brand view in the preview at desktop and mobile widths.
