import type { JSX, ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type AppTableColumn<TRow> = {
  cell: (row: TRow) => ReactNode;
  header: ReactNode;
  id: string;
};

type AppTableProps<TRow> = {
  columns: AppTableColumn<TRow>[];
  getRowId: (row: TRow) => string;
  rows: TRow[];
};

export function AppTable<TRow>({ columns, getRowId, rows }: AppTableProps<TRow>): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.id}>{column.header}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={getRowId(row)}>
            {columns.map((column) => (
              <TableCell key={column.id}>{column.cell(row)}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
