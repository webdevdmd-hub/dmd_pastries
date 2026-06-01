import type { JSX } from "react";

import { Skeleton } from "@/components/ui/skeleton";

export function ManufacturingReportSkeleton(): JSX.Element {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton className="h-14 rounded-2xl" key={index} />
      ))}
    </div>
  );
}
