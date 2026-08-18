import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes, JSX } from "react";

import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  // 22px tall, fully round, 12.5px at weight 500 (DESIGN.md §6).
  "inline-flex h-[22px] items-center gap-1.5 rounded-full px-2.5 text-meta font-medium",
  {
    variants: {
      variant: {
        // --- Semantic. These carry a dot; see `showsDot` below. --------------
        // Paid, reconciled, posted. The money accent, and only for money.
        money: "bg-money-tint text-money-text",
        // Held, overdue: needs attention, but nothing is broken.
        warning: "bg-warning-tint text-warning-text",
        // Void, unbalanced, failed.
        danger: "bg-danger-tint text-danger-text",
        // Pending, in progress, informational.
        info: "bg-info-tint text-info-text",
        // Draft is deliberately neutral: DESIGN.md calls it "the absence of a
        // state, not a state", so it must not borrow a semantic colour.
        draft: "bg-muted text-foreground-muted",

        // --- Legacy, kept for the 39 existing call sites. --------------------
        // Restyled onto tokens but dotless, so adopting the new variants stays
        // an explicit choice rather than 39 badges silently sprouting dots.
        default: "border border-border bg-muted text-foreground",
        outline: "border border-border bg-transparent text-foreground-muted",
        secondary: "border border-border bg-card text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const SEMANTIC_VARIANTS = ["money", "warning", "danger", "info", "draft"] as const;

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

function showsDot(variant: BadgeVariant | null | undefined): boolean {
  return SEMANTIC_VARIANTS.some((name) => name === variant);
}

type BadgeProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof badgeVariants> & {
    /** Force the state dot on or off. Defaults to on for semantic variants. */
    dot?: boolean;
  };

function Badge({ className, variant, dot, children, ...props }: BadgeProps): JSX.Element {
  const withDot = dot ?? showsDot(variant);

  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {withDot ? (
        // Not decoration. Colour alone may not carry state (DESIGN.md §9), so
        // the dot gives a colour-blind user a second, positional signal.
        <span aria-hidden="true" className="h-[5px] w-[5px] shrink-0 rounded-full bg-current" />
      ) : null}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
