import type { JSX } from "react";

import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton(): JSX.Element {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton className="h-32 rounded-lg" key={index} />
        ))}
      </div>
      <Skeleton className="h-72 rounded-lg" />
    </div>
  );
}
