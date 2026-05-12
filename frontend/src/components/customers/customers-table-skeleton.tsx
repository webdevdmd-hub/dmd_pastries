import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function CustomersTableSkeleton(): JSX.Element {
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr]" key={index}>
            <Skeleton className="h-12 rounded-2xl" />
            <Skeleton className="h-12 rounded-2xl" />
            <Skeleton className="h-12 rounded-2xl" />
            <Skeleton className="h-12 rounded-2xl" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
