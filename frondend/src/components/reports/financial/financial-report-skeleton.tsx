import type { JSX } from "react";

import { Skeleton } from "@/components/ui/skeleton";

export function FinancialReportSkeleton(): JSX.Element {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton className="h-12 rounded-xl" key={index} />
      ))}
    </div>
  );
}
