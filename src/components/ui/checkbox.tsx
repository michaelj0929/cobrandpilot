import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";

import { cn } from "@/lib/utils";

/**
 * Design-system checkbox: an 18px rounded square. Checked fills with brand
 * and shows a white inner ring around a brand center (the Suggestion style).
 */
const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer size-[18px] shrink-0 rounded-[5px] border-[1.5px] border-line-mid bg-card cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=checked]:shadow-[inset_0_0_0_3px_var(--brand),inset_0_0_0_5px_var(--on-brand)]",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator />
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
