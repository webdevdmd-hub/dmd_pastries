import type { HTMLAttributes, JSX } from "react";

import { cn } from "@/lib/utils/cn";

function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div className={cn("animate-pulse rounded-md bg-brand-cappuccino/50", className)} {...props} />
  );
}

export { Skeleton };
