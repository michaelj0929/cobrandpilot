import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Empty, SectionHead, StateBadge } from "@/components/app-shell";
import { BusyLine } from "@/components/loading";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { listGaps } from "@/lib/cobrand-client";
import { addManualRule, proposeForGap, runGapCheck } from "@/lib/cobrand.functions";

/** Brand Check: what the brand model is missing or too vague about. */
export function SetupGapsPanel({ brandId }: { brandId: string }) {
  const queryClient = useQueryClient();
  const gapCheck = useServerFn(runGapCheck);
  const propose = useServerFn(proposeForGap);
  const addRule = useServerFn(addManualRule);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answering, setAnswering] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");

  const gaps = useQuery({ queryKey: ["gaps", brandId], queryFn: () => listGaps(brandId) });
  const refresh = () => {
    for (const key of ["gaps", "rules", "versions", "brand"]) {
      queryClient.invalidateQueries({ queryKey: [key, brandId] });
    }
  };

  const recheck = useMutation({
    mutationFn: async () => {
      setError(null);
      setBusy("Checking the model for gaps…");
      await gapCheck({ data: { brandId } });
      refresh();
    },
    onSettled: () => setBusy(null),
    onError: (e) => setError((e as Error).message),
  });

  const proposeFor = useMutation({
    mutationFn: async (gapId: string) => {
      setError(null);
      setBusy("Drafting a candidate rule…");
      const result = await propose({ data: { gapId } });
      refresh();
      if (!result.proposed) setError(result.reason);
    },
    onSettled: () => setBusy(null),
    onError: (e) => setError((e as Error).message),
  });

  const answerGap = useMutation({
    mutationFn: async (gap: { id: string; topic: string; layer: string | null }) => {
      setBusy("Saving…");
      await addRule({
        data: {
          brandId,
          gapId: gap.id,
          layer: gap.layer ?? "identity",
          ruleType: "other",
          label: gap.topic,
          statement: answer.trim(),
          value: "",
          severity: "must",
        },
      });
      setAnswering(null);
      setAnswer("");
      refresh();
    },
    onSettled: () => setBusy(null),
    onError: (e) => setError((e as Error).message),
  });

  const openGaps = (gaps.data ?? []).filter((g) => !g.resolved);

  return (
    <div>
      <SectionHead
        title="Brand Check"
        description="What the brand model is missing or too vague about. These stay visible until they are answered — CoBrand will not guess."
        actions={
          <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => recheck.mutate()}>
            Re-check
          </Button>
        }
      />
      {busy ? <BusyLine text={busy} /> : null}
      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {openGaps.length === 0 ? (
          <Empty
            title="Nothing outstanding"
            body="Once materials are ingested, anything missing or vague appears here."
          />
        ) : (
          openGaps.map((gap) => (
            <div key={gap.id} className="surface px-6 py-5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold">{gap.topic}</p>
                <StateBadge state={gap.gap_type} />
              </div>
              {gap.why_it_matters ? (
                <p className="mt-1.5 text-sm text-ink-muted">{gap.why_it_matters}</p>
              ) : null}
              {gap.source_note ? (
                <p className="mt-1.5 text-xs text-ink-muted">{gap.source_note}</p>
              ) : null}
              {answering === gap.id ? (
                <div className="mt-3">
                  <Textarea
                    rows={3}
                    autoFocus
                    placeholder="Write the answer in your own words…"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                  />
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      disabled={!!busy || answer.trim().length < 3}
                      onClick={() => answerGap.mutate(gap)}
                    >
                      Save as brand truth
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setAnswering(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3.5 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setAnswering(gap.id);
                      setAnswer("");
                    }}
                  >
                    Answer it
                  </Button>
                  <Button
                    size="sm"
                    variant="quiet"
                    disabled={!!busy}
                    onClick={() => proposeFor.mutate(gap.id)}
                  >
                    Let CoBrand propose
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
