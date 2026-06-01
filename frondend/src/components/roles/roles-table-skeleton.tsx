import type { JSX } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function RolesTableSkeleton(): JSX.Element {
  return (
    <Card>
      <CardHeader className="space-y-4">
        <Skeleton className="h-6 w-40 rounded-full" />
        <Skeleton className="h-4 w-72 rounded-full" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-2xl" />
      </CardContent>
    </Card>
  );
}
