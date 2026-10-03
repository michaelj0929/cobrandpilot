import type { ReactNode } from "react";

/**
 * Design-system loading pieces: a brand-tint side panel with a floating
 * line-art illustration, step lists with 20px dots, and an inline busy line.
 * Animations stop for reduced-motion users.
 */

export type Step = { label: string; state: "done" | "live" | "waiting" };

export function LoadingPanel({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <aside
      aria-live="polite"
      className="flex flex-col items-center gap-5 rounded-lg bg-brand-tint px-7 py-8 text-center"
    >
      <FolderArt />
      <h2 className="text-[15px]">{title}</h2>
      {children ? <div className="self-stretch px-2 text-left">{children}</div> : null}
      <p className="text-xs text-ink-muted">This usually takes under a minute.</p>
    </aside>
  );
}

export function StepList({ steps }: { steps: Step[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {steps.map((step) => (
        <li
          key={step.label}
          className={`flex items-center gap-3 text-sm ${
            step.state === "live"
              ? "font-semibold text-brand"
              : step.state === "waiting"
                ? "text-ink-muted"
                : "text-ink"
          }`}
        >
          <StepDot state={step.state} />
          {step.label}
          <span className="sr-only">
            {step.state === "done"
              ? "(done)"
              : step.state === "live"
                ? "(in progress)"
                : "(waiting)"}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function StepDot({ state }: { state: Step["state"] }) {
  if (state === "done") {
    return (
      <span
        aria-hidden
        className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand"
      >
        <svg
          width="10"
          height="8"
          viewBox="0 0 16 11"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1 5l4 4 9-8" />
        </svg>
      </span>
    );
  }
  if (state === "live") return <Spinner className="size-5" />;
  return (
    <span aria-hidden className="size-5 shrink-0 rounded-full border-[1.5px] border-line-mid" />
  );
}

export function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`${className} shrink-0 animate-spin rounded-full border-2 border-brand border-r-transparent motion-reduce:animate-none`}
    />
  );
}

/** A single in-progress line for short waits. */
export function BusyLine({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2.5 text-sm font-semibold text-brand" aria-live="polite">
      <Spinner />
      {text}
    </p>
  );
}

/** Folder with a tilted brand layer: the loading-panel illustration. */
function FolderArt() {
  return (
    <svg
      aria-hidden
      width="150"
      height="120"
      viewBox="0 0 150 120"
      fill="none"
      stroke="var(--ink)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="animate-[cb-float_3.2s_ease-in-out_infinite] motion-reduce:animate-none"
    >
      <rect
        x="30"
        y="22"
        width="56"
        height="44"
        rx="10"
        fill="var(--brand)"
        transform="rotate(-12 58 44)"
      />
      <path
        d="M22 44h34l10 10h52a8 8 0 0 1 8 8v42a8 8 0 0 1-8 8H22a8 8 0 0 1-8-8V52a8 8 0 0 1 8-8z"
        fill="var(--yellow-tint)"
      />
      <path d="M110 18c10 2 16 10 16 20" />
      <path d="M122 34l4 6 6-4" />
      <path d="M12 80c-6-6-6-16 0-22" />
    </svg>
  );
}
