import { useEffect } from "react";

import { isColor, ruleValue, type BrandRule } from "@/lib/cobrand-client";

/** Score bar: 8px brand-tint track, brand fill. */
export function Meter({ value, tone }: { value: number | null; tone?: string }) {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-brand-tint">
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${pct}%`, backgroundColor: tone ?? "var(--brand-accent)" }}
      />
    </div>
  );
}

/** Score ring — replaces bare numeric stats. */
export function ScoreRing({
  value,
  size = 96,
  label,
}: {
  value: number | null;
  size?: number;
  label?: string;
}) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  const stroke = size < 60 ? 5 : 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--brand-soft)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--brand-accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * pct) / 100}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="leading-none font-semibold text-ink" style={{ fontSize: size * 0.31 }}>
          {value === null ? "—" : Math.round(value)}
        </span>
        {label ? (
          <span className="mt-1 text-[10px] font-semibold text-ink-muted">{label}</span>
        ) : null}
      </div>
    </div>
  );
}

/** A real colour chip rather than a hex string. */
export function Swatch({ hex, name, note }: { hex: string; name: string; note?: string }) {
  return (
    <figure className="overflow-hidden rounded-md border border-line-soft bg-card">
      <div className="h-24 w-full" style={{ backgroundColor: hex }} aria-hidden />
      <figcaption className="px-4 py-3">
        <p className="text-sm font-semibold">{name}</p>
        <p className="mt-0.5 font-mono text-xs uppercase text-ink-muted">{hex}</p>
        {note ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{note}</p> : null}
      </figcaption>
    </figure>
  );
}

/** Set the type in the typeface it describes. */
export function TypeSpecimen({
  family,
  name,
  note,
}: {
  family: string;
  name: string;
  note?: string;
}) {
  useLoadFont(family);
  const stack = `"${family}", var(--font-sans)`;
  return (
    <figure className="rounded-md border border-line-soft bg-card px-5 py-5">
      <p className="truncate leading-none" style={{ fontFamily: stack, fontSize: "2.5rem" }}>
        Aa Bb Cc
      </p>
      <p
        className="mt-3 text-sm text-muted-foreground"
        style={{ fontFamily: stack, fontSize: "1rem" }}
      >
        The quick brown fox jumps over the lazy dog — 0123456789
      </p>
      <figcaption className="mt-4 border-t border-line-soft pt-3">
        <p className="text-sm font-semibold">{name}</p>
        {note ? <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{note}</p> : null}
      </figcaption>
    </figure>
  );
}

const loaded = new Set<string>();

function useLoadFont(family: string) {
  useEffect(() => {
    const clean = family.trim();
    if (!clean || loaded.has(clean) || typeof document === "undefined") return;
    if (!/^[A-Za-z0-9 ]{2,40}$/.test(clean)) return;
    loaded.add(clean);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(clean).replace(/%20/g, "+")}:wght@400;500;700&display=swap`;
    document.head.appendChild(link);
  }, [family]);
}

/** Pull a font family name out of a typography rule's value or statement. */
export function fontFamilyOf(rule: BrandRule): string | null {
  const raw = ruleValue(rule.value).trim();
  const candidate = raw || rule.label;
  const cleaned = candidate
    .replace(/\b(bold|regular|medium|light|semibold|italic|black|display|text)\b/gi, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length >= 2 ? cleaned : null;
}
