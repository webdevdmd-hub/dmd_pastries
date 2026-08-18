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
          // Height follows the density register (36px Ledger / 48px Counter) so
          // a field sits flush with a Button of the same size. The focus ring
          // was `ring-brand-caramel`, which aliases to --primary (#171717): a
          // near-black ring that was effectively invisible. Focus is blue and
          // only blue (DESIGN.md §3.4).
          "flex h-field w-full rounded border border-border bg-card px-3 py-2 text-cell text-foreground placeholder:text-foreground-disabled focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
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
