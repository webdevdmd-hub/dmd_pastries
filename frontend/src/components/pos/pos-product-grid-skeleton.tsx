import type { JSX } from "react";

import { Skeleton } from "@/components/ui/skeleton";

export function POSProductGridSkeleton(): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 12 }).map((_, index) => (
        <Skeleton
          className="h-[14.5rem] rounded-lg border border-border bg-muted"
          key={`pos-product-skeleton-${String(index)}`}
        />
      ))}
    </div>
  );
}
