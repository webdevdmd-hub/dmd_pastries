import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function UsersTableSkeleton(): JSX.Element {
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <Skeleton className="h-11 w-full rounded-2xl" />
        <div className="space-y-3">
          <Skeleton className="h-14 rounded-2xl" />
          <Skeleton className="h-14 rounded-2xl" />
          <Skeleton className="h-14 rounded-2xl" />
          <Skeleton className="h-14 rounded-2xl" />
          <Skeleton className="h-14 rounded-2xl" />
        </div>
      </CardContent>
    </Card>
  );
}
