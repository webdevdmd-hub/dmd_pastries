import * as React from "react";

import { cn } from "@/lib/utils/cn";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    const isNumberInput = type === "number";

    return (
      <input
        type={type}
        inputMode={props.inputMode ?? (isNumberInput ? "decimal" : undefined)}
        step={props.step ?? (isNumberInput ? "0.001" : undefined)}
        suppressHydrationWarning
        className={cn(
          "flex h-11 w-full rounded-xl border border-workspace-border bg-workspace-panel px-3 py-2 text-sm text-brand-espresso placeholder:text-workspace-muted/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-caramel focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-brand-latte disabled:opacity-60",
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
