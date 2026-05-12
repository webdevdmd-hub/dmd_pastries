import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function PurchaseTableSkeleton(): JSX.Element {
  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton className="h-12 w-full rounded-xl" key={index} />
        ))}
      </CardContent>
    </Card>
  );
}
