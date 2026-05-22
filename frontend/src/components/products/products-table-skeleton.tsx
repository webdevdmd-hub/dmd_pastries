"use client";

import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ProductsTableSkeleton(): JSX.Element {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="border-b border-brand-cappuccino/70 p-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="mt-2 h-3 w-64" />
        </div>
        <div className="space-y-3 p-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}
