import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  // Focus is blue and only blue (DESIGN.md §3.4). This was
  // `focus-visible:ring-brand-caramel`, and `brand-caramel` aliases to
  // `--primary` (#171717) — so every focusable control in the app carried a
  // near-black focus ring, and on a black primary button it was invisible.
  // Keyboard and switch users had no way to see which control was focused,
  // including the safe-by-default button on a destructive confirm dialog.
  //
  // Weight is 500, not 600: DESIGN.md §2 makes 500 the workhorse and reserves
  // 600 for page titles. Radius is the 10px token, down from rounded-xl.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded text-cell font-medium transition-colors duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // `default` is the primary role of DESIGN.md §6. Kept under this key
        // rather than renamed to `primary`, because ~15 call sites select it
        // dynamically (`variant={cond ? "outline" : "default"}`) and renaming
        // would churn them for no visual change.
        default: "bg-primary text-primary-foreground hover:bg-primary/90",

        // The one accent. Reserved for money-committing actions — Charge, Post,
        // Confirm payment, Close period — and never more than one per screen.
        // DESIGN.md §3.2: "If two things on a screen are green, one is wrong."
        commit: "bg-money text-money-foreground hover:bg-money-hover",

        outline: "border border-border bg-card text-foreground hover:bg-muted",
        ghost: "text-foreground hover:bg-muted",

        // Void, delete, refund. A bordered card surface with a danger-coloured
        // label, not a filled red block — a destructive action should read as
        // deliberate, not as the loudest thing on the screen.
        danger: "border border-border bg-card text-danger-text hover:bg-danger-tint",

        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        // `default` follows the density register: 36px on Ledger surfaces,
        // 48px inside a counter surface, without the call site knowing which.
        default: "h-control px-4",
        sm: "h-8 px-3",
        lg: "h-11 px-6",
        counter: "h-12 px-6 text-body",
        icon: "h-control w-control min-h-tap min-w-tap p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        suppressHydrationWarning
        {...props}
      />
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
