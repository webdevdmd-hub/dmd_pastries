"use client";

import { Pencil, Trash2 } from "lucide-react";
import type { JSX } from "react";

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
import type { RecipeIngredientLine } from "@/types/recipes";

type RecipeIngredientTableProps = {
  canManage: boolean;
  lines: RecipeIngredientLine[];
  onDelete: (line: RecipeIngredientLine) => void;
  onEdit: (line: RecipeIngredientLine) => void;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function componentLabel(line: RecipeIngredientLine): string {
  return line.componentProductName ?? line.itemNameSnapshot;
}

export function RecipeIngredientTable({
  canManage,
  lines,
  onDelete,
  onEdit,
}: RecipeIngredientTableProps): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ingredient</TableHead>
          <TableHead>Qty</TableHead>
          <TableHead>Unit Cost</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Wastage</TableHead>
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
              {line.notes ? <p className="text-xs text-brand-mocha">{line.notes}</p> : null}
            </TableCell>
            <TableCell>
              {line.quantityRequired} {line.unitSymbol}
            </TableCell>
            <TableCell>{formatCurrency(line.unitCostSnapshot)}</TableCell>
            <TableCell>{formatCurrency(line.totalCost)}</TableCell>
            <TableCell>{line.wastagePercentage}%</TableCell>
            <TableCell>
              {canManage ? (
                <div className="flex gap-2">
                  <Button
                    aria-label="Edit ingredient line"
                    onClick={() => onEdit(line)}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    aria-label="Delete ingredient line"
                    onClick={() => onDelete(line)}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 className="h-4 w-4 text-red-700" />
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
