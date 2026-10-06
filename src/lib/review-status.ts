export type ReviewVerdictKey = "pass" | "revise" | "fail";

export type ReviewVerdict = {
  label: "On Brand (Approved)" | "Minor Revisions Needed" | "Off Brand (Rework Needed)";
  description: string;
  /** Tinted pill: border + background + text colour. */
  className: string;
  /** Solid colour for dots and accents. */
  dotClassName: string;
  icon: ReviewVerdictKey;
};

export function reviewVerdict(score: number | null | undefined): ReviewVerdict {
  if ((score ?? 0) >= 80) {
    return {
      label: "On Brand (Approved)",
      description:
        "Green light. Visually and verbally matches all brand guidelines; clear for launch.",
      className: "border-green/25 bg-green-tint text-green",
      dotClassName: "bg-green",
      icon: "pass",
    };
  }

  if ((score ?? 0) >= 60) {
    return {
      label: "Minor Revisions Needed",
      description: "The concept is solid, but needs a few small adjustments before launch.",
      className: "border-amber/35 bg-amber-tint text-amber",
      dotClassName: "bg-amber",
      icon: "revise",
    };
  }

  return {
    label: "Off Brand (Rework Needed)",
    description:
      "Misses the brand identity or guidelines. It needs a fresh approach before moving forward.",
    className: "border-rose/25 bg-rose-tint text-rose",
    dotClassName: "bg-rose",
    icon: "fail",
  };
}

export function averageScores(...scores: Array<number | null | undefined>) {
  const available = scores.filter((score): score is number => typeof score === "number");
  if (available.length === 0) return null;
  return available.reduce((total, score) => total + score, 0) / available.length;
}
