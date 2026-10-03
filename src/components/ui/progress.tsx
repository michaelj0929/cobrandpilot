"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

/**
 * Design-system progress bar: a 36px `page` track with a `brand` fill.
 * Pass `label` (e.g. "72% complete") to print it inside the fill.
 */
const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & { label?: React.ReactNode }
>(({ className, value, label, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    value={value}
    className={cn(
      "relative h-9 w-full overflow-hidden rounded-md border border-line-soft bg-page",
      className,
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="flex h-full items-center rounded-[9px] bg-brand pl-4 text-[13px] font-semibold whitespace-nowrap text-on-brand transition-[width] duration-500 motion-reduce:transition-none"
      style={{ width: `${value ?? 0}%` }}
    >
      {label}
    </ProgressPrimitive.Indicator>
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
