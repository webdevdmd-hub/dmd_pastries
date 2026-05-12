import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function PaymentsTableSkeleton(): JSX.Element {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton className="h-14 rounded-2xl" key={String(index)} />
        ))}
      </CardContent>
    </Card>
  );
}
