export type ReviewVerdict = {
  label: "On Brand (Approved)" | "Minor Revisions Needed" | "Off Brand (Rework Needed)";
  description: string;
  className: string;
  dotClassName: string;
};

export function reviewVerdict(score: number | null | undefined): ReviewVerdict {
  if ((score ?? 0) >= 80) {
    return {
      label: "On Brand (Approved)",
      description:
        "Green light. Visually and verbally matches all brand guidelines; clear for launch.",
      className: "border-green/20 bg-green-tint text-green",
      dotClassName: "bg-green",
    };
  }

  if ((score ?? 0) >= 60) {
    return {
      label: "Minor Revisions Needed",
      description: "The concept is solid, but needs a few small adjustments before launch.",
      className: "border-attention/30 bg-attention/15 text-ink",
      dotClassName: "bg-attention",
    };
  }

  return {
    label: "Off Brand (Rework Needed)",
    description:
      "Misses the brand identity or guidelines. It needs a fresh approach before moving forward.",
    className: "border-destructive/20 bg-destructive/5 text-destructive",
    dotClassName: "bg-destructive",
  };
}

export function averageScores(...scores: Array<number | null | undefined>) {
  const available = scores.filter((score): score is number => typeof score === "number");
  if (available.length === 0) return null;
  return available.reduce((total, score) => total + score, 0) / available.length;
}