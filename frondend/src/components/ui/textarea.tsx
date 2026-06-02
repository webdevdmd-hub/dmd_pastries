import * as React from "react";

import { cn } from "@/lib/utils/cn";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "flex min-h-24 w-full rounded-xl border border-brand-cappuccino bg-brand-latte px-3 py-2 text-sm text-brand-espresso placeholder:text-brand-mocha/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-caramel focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      suppressHydrationWarning
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export { Textarea };
