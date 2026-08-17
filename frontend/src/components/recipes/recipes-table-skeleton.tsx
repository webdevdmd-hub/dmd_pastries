"use client";

import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function RecipesTableSkeleton(): JSX.Element {
  return (
    <Card className="bg-card/80">
      <CardContent className="space-y-3 p-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton className="h-14 rounded-2xl" key={index} />
        ))}
      </CardContent>
    </Card>
  );
}
