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

/**
 * Loading stand-in for the PO detail page (G6). The page is a header card, a
 * KPI row, a workflow tracker, and a two-column body -- a table skeleton in
 * that spot promised a layout the page never renders.
 */
export function PurchaseDetailSkeleton(): JSX.Element {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <Skeleton className="h-4 w-44" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-56" />
            <Skeleton className="h-6 w-32 rounded-full" />
          </div>
          <Skeleton className="h-4 w-72" />
        </CardContent>
      </Card>
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="space-y-3 p-5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="grid gap-3 p-5 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton className="h-24 w-full rounded-md" key={index} />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-3 p-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton className="h-10 w-full" key={index} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
