import type { JSX } from "react";

import { Skeleton } from "@/components/ui/skeleton";

export function POSProductGridSkeleton(): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {Array.from({ length: 12 }).map((_, index) => (
        <Skeleton
          className="h-48 rounded-[1.6rem] bg-brand-cappuccino/45"
          key={`pos-product-skeleton-${String(index)}`}
        />
      ))}
    </div>
  );
}
