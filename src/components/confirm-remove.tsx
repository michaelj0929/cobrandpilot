import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Two-step remove: first click arms the button (it widens and turns red),
 * second click confirms. Resets on its own after a few seconds or on Cancel.
 */
export function ConfirmRemove({
  onConfirm,
  disabled,
  label = "Remove",
  confirmLabel = "Delete guidelines?",
}: {
  onConfirm: () => void;
  disabled?: boolean;
  label?: string;
  confirmLabel?: string;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={disabled}
        aria-live="polite"
        onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}
        className={cn(
          "inline-flex h-8 cursor-pointer items-center gap-1.5 overflow-hidden rounded-md px-3 text-sm font-medium whitespace-nowrap transition-all duration-300 ease-out disabled:cursor-not-allowed disabled:opacity-50",
          armed
            ? "bg-destructive text-destructive-foreground shadow-sm max-w-[220px]"
            : "max-w-[120px] text-ink-muted hover:bg-page hover:text-ink",
        )}
      >
        <Trash2
          aria-hidden
          className={cn("size-3.5 transition-all duration-300", armed ? "w-3.5 opacity-100" : "w-0 opacity-0")}
        />
        {armed ? confirmLabel : label}
      </button>
      <button
        type="button"
        onClick={() => setArmed(false)}
        tabIndex={armed ? 0 : -1}
        className={cn(
          "h-8 overflow-hidden rounded-md text-sm text-ink-muted transition-all duration-300 hover:text-ink",
          armed ? "max-w-[80px] px-2 opacity-100" : "max-w-0 px-0 opacity-0",
        )}
      >
        Cancel
      </button>
    </div>
  );
}
