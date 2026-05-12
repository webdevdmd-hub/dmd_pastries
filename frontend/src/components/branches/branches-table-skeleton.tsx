import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function BranchesTableSkeleton(): JSX.Element {
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        {Array.from({ length: 5 }).map((_, index) => (
          <div className="grid gap-3 md:grid-cols-[1fr_0.7fr_0.7fr_0.5fr]" key={index}>
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
