import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2.5 whitespace-nowrap rounded-md border-[1.5px] border-transparent text-sm leading-[18px] font-semibold tracking-[0.2px] cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Solid: the one main action per screen.
        default: "bg-brand text-on-brand shadow-brand hover:bg-brand-deep",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        // Outline: every other action.
        outline: "border-brand bg-card text-brand hover:bg-brand-tint",
        secondary: "border-brand bg-card text-brand hover:bg-brand-tint",
        // Quiet white: low-emphasis actions next to content.
        quiet: "border-line-soft bg-card text-ink hover:bg-page",
        ghost: "text-ink hover:bg-page",
        link: "border-0 px-0 text-brand hover:text-brand-deep hover:underline underline-offset-[3px]",
      },
      size: {
        default: "min-h-11 px-5",
        sm: "min-h-9 px-3.5 text-[13px]",
        lg: "min-h-11 px-7",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
