import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageHead } from "@/components/app-shell";
import { BusyLine } from "@/components/loading";
import { Button } from "@/components/ui/button";
import { listChecks, listReviewProjects } from "@/lib/cobrand-client";
import { reviewVerdict } from "@/lib/review-status";

export const Route = createFileRoute("/_authenticated/brands/$brandId/reviews")({
  head: () => ({
    meta: [
      { title: "Past Reviews — CoBrand" },
      { name: "description", content: "Every creative review project, its dates and its assets." },
      { property: "og:title", content: "Past Reviews — CoBrand" },
      { property: "og:description", content: "Browse past creative review projects and scores." },
    ],
  }),
  component: PastReviews,
});

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function PastReviews() {
  const { brandId } = useParams({ from: "/_authenticated/brands/$brandId/reviews" });
  const projects = useQuery({
    queryKey: ["review-projects", brandId],
    queryFn: () => listReviewProjects(brandId),
  });
  const checks = useQuery({ queryKey: ["checks", brandId], queryFn: () => listChecks(brandId) });
  const loose = (checks.data ?? []).filter(
    (c) => !(c as { project_id?: string | null }).project_id,
  );

  return (
    <>
      <PageHead
        title="Past Reviews"
        description="Every review project, with its dates, brief context and the assets checked."
      />
      <div className="mb-6">
        <Button asChild>
          <Link to="/brands/$brandId/review" params={{ brandId }}>
            Creative Review
          </Link>
        </Button>
      </div>

      {projects.isLoading ? <BusyLine text="Loading reviews…" /> : null}

      <div className="flex flex-col gap-4">
        {(projects.data ?? []).map((project) => {
          const items = [...(project.validation_checks ?? [])].sort((a, b) =>
            a.created_at.localeCompare(b.created_at),
          );
          const overdue =
            project.deadline && project.deadline < new Date().toISOString().slice(0, 10);
          return (
            <section key={project.id} className="surface rise-enter px-6 py-[22px]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2>{project.title}</h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    {project.creating} · {project.objective} · {project.audience}
                  </p>
                </div>
                <div className="text-right text-xs text-ink-muted">
                  <p>Reviewed {formatDate(project.review_date)}</p>
                  {project.deadline ? (
                    <p className={overdue ? "font-semibold text-destructive" : ""}>
                      Deadline {formatDate(project.deadline)}
                    </p>
                  ) : null}
                </div>
              </div>
              <ul className="mt-4 text-sm">
                {items.map((check) => {
                  const verdict = reviewVerdict(check.score);
                  return (
                  <li key={check.id} className="border-t border-line-soft">
                    <Link
                      to="/reviews/$checkId"
                      params={{ checkId: check.id }}
                      className="-mx-3 flex items-center justify-between gap-3 rounded-md px-3 py-3 transition-colors hover:bg-page"
                    >
                      <span className="truncate font-medium">
                        {check.asset_name ?? check.label ?? check.input_type}
                      </span>
                      <span className={`inline-flex min-h-6 shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${verdict.className}`}>
                        <span className={`size-1.5 rounded-full ${verdict.dotClassName}`} aria-hidden />
                        {verdict.label}
                      </span>
                    </Link>
                  </li>
                  );
                })}
                {items.length === 0 ? (
                  <li className="border-t border-line-soft py-3 text-xs text-ink-muted">
                    No assets reviewed yet.
                  </li>
                ) : null}
              </ul>
            </section>
          );
        })}

        {loose.length > 0 ? (
          <section className="surface px-6 py-[22px]">
            <h2>Earlier reviews</h2>
            <p className="mt-1 text-sm text-ink-muted">Reviewed before projects were added.</p>
            <ul className="mt-4 text-sm">
              {loose.map((check) => {
                const verdict = reviewVerdict(check.score);
                return (
                <li key={check.id} className="border-t border-line-soft">
                  <Link
                    to="/reviews/$checkId"
                    params={{ checkId: check.id }}
                    className="-mx-3 flex items-center justify-between gap-3 rounded-md px-3 py-3 transition-colors hover:bg-page"
                  >
                    <span className="truncate font-medium">
                      {check.asset_name ?? check.label ?? check.input_type}
                    </span>
                    <span className={`inline-flex min-h-6 shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${verdict.className}`}>
                      <span className={`size-1.5 rounded-full ${verdict.dotClassName}`} aria-hidden />
                      {verdict.label}
                    </span>
                  </Link>
                </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {projects.isSuccess && projects.data.length === 0 && loose.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing reviewed yet.</p>
        ) : null}
      </div>
    </>
  );
}
