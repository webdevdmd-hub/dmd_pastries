import type { JSX } from "react";

import { Skeleton } from "@/components/ui/skeleton";

export function LoadingState(): JSX.Element {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-12 w-48 rounded-2xl" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-32 rounded-3xl" />
      </div>
      <Skeleton className="h-72 rounded-3xl" />
    </div>
  );
}
