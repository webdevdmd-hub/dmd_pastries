import * as React from "react";

import { cn } from "@/lib/utils/cn";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        // See input.tsx — same token pass, same blue-only focus ring.
        "flex min-h-24 w-full rounded border border-border bg-card px-3 py-2 text-cell text-foreground placeholder:text-foreground-disabled focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
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
