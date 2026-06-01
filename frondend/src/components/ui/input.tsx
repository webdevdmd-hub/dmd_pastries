import * as React from "react";

import { cn } from "@/lib/utils/cn";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        suppressHydrationWarning
        className={cn(
          "flex h-11 w-full rounded-xl border border-brand-cappuccino bg-brand-latte px-3 py-2 text-sm text-brand-espresso placeholder:text-brand-mocha/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-caramel focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
