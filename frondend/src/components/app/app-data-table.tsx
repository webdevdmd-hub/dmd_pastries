import type { JSX, ReactNode } from "react";

import { AppEmptyState } from "@/components/app/app-empty-state";
import { AppTable, type AppTableColumn } from "@/components/app/app-table";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export type AppDataTableProps<TRow> = {
  columns: AppTableColumn<TRow>[];
  emptyDescription: string;
  emptyTitle: string;
  getRowId: (row: TRow) => string;
  isLoading?: boolean;
  rows: TRow[];
  toolbar?: ReactNode;
};

export function AppDataTable<TRow>({
  columns,
  emptyDescription,
  emptyTitle,
  getRowId,
  isLoading = false,
  rows,
  toolbar,
}: AppDataTableProps<TRow>): JSX.Element {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-3 p-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton className="h-14 rounded-2xl" key={index} />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return <AppEmptyState description={emptyDescription} title={emptyTitle} />;
  }

  return (
    <div className="grid gap-4">
      {toolbar}
      <Card>
        <CardContent className="p-0">
          <AppTable columns={columns} getRowId={getRowId} rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
