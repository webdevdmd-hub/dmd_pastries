import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function MovementsTableSkeleton(): JSX.Element {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton className="h-12 rounded-2xl" key={index} />
        ))}
      </CardContent>
    </Card>
  );
}
