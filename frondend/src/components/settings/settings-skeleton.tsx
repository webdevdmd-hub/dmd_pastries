import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function SettingsSkeleton(): JSX.Element {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={index}>
          <CardContent className="space-y-5 p-6">
            <Skeleton className="h-12 w-12 rounded-2xl" />
            <div className="space-y-3">
              <Skeleton className="h-5 w-44 rounded-full" />
              <Skeleton className="h-4 w-full rounded-full" />
              <Skeleton className="h-4 w-5/6 rounded-full" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-10 w-28 rounded-xl" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
