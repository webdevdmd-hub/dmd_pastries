"use client";

import { Pencil, Trash2 } from "lucide-react";
import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PRODUCT_TYPE_LABELS } from "@/types/product";
import type { RecipePackagingLine } from "@/types/recipes";

type RecipePackagingTableProps = {
  canManage: boolean;
  lines: RecipePackagingLine[];
  onDelete: (line: RecipePackagingLine) => void;
  onEdit: (line: RecipePackagingLine) => void;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function componentLabel(line: RecipePackagingLine): string {
  return line.componentProductName ?? line.packagingNameSnapshot;
}

export function RecipePackagingTable({
  canManage,
  lines,
  onDelete,
  onEdit,
}: RecipePackagingTableProps): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Packaging</TableHead>
          <TableHead>Qty</TableHead>
          <TableHead>Unit Cost</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((line) => (
          <TableRow key={line.id}>
            <TableCell>
              <p className="font-semibold text-brand-espresso">{componentLabel(line)}</p>
              <p className="text-xs text-brand-mocha">
                {line.componentProductType
                  ? PRODUCT_TYPE_LABELS[line.componentProductType]
                  : "Legacy item"}
                {line.componentVariantName ? ` · ${line.componentVariantName}` : ""}
              </p>
            </TableCell>
            <TableCell className="tabular-nums">
              {line.quantityRequired} {line.unitSymbol}
            </TableCell>
            <TableCell className="tabular-nums">{formatCurrency(line.unitCostSnapshot)}</TableCell>
            <TableCell className="tabular-nums">{formatCurrency(line.totalCost)}</TableCell>
            <TableCell>
              <Badge variant="outline">{line.isOptional ? "Optional" : "Required"}</Badge>
            </TableCell>
            <TableCell>
              {canManage ? (
                <div className="flex gap-2">
                  <Button
                    aria-label="Edit packaging line"
                    onClick={() => onEdit(line)}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    aria-label="Delete packaging line"
                    onClick={() => onDelete(line)}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 className="h-4 w-4 text-danger-text" />
                  </Button>
                </div>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
