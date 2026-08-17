import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function OrdersTableSkeleton(): JSX.Element {
  return (
    <Card className="bg-card/85">
      <CardContent className="grid gap-3 p-5">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton className="h-14 rounded-2xl" key={index} />
        ))}
      </CardContent>
    </Card>
  );
}
