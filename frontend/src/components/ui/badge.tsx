import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes, JSX } from "react";

import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-brand-cappuccino bg-brand-cappuccino/60 text-brand-espresso",
        outline: "border-brand-cappuccino bg-transparent text-brand-mocha",
        secondary: "border-brand-caramel bg-brand-caramel/15 text-brand-mocha",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type BadgeProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>;

function Badge({ className, variant, ...props }: BadgeProps): JSX.Element {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
