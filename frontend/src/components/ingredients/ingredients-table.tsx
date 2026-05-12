"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSX } from "react";

import { IngredientActionsMenu } from "@/components/ingredients/ingredient-actions-menu";
import { IngredientStatusBadge } from "@/components/ingredients/ingredient-status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/constants/routes";
import type { Ingredient } from "@/types/ingredient";

type IngredientsTableProps = {
  canManage: boolean;
  items: Ingredient[];
  onDelete: (item: Ingredient) => void;
  onEdit: (item: Ingredient) => void;
  onStatusChange: (item: Ingredient, status: Ingredient["status"]) => void;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value))
    : "Not recorded";
}

export function IngredientsTable({
  canManage,
  items,
  onDelete,
  onEdit,
  onStatusChange,
}: IngredientsTableProps): JSX.Element {
  const router = useRouter();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ingredient</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Supplier</TableHead>
          <TableHead>Unit</TableHead>
          <TableHead>Cost</TableHead>
          <TableHead>Stock</TableHead>
          <TableHead>Expiry</TableHead>
          <TableHead>Reorder Level</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created At</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow className={item.status === "inactive" ? "opacity-65" : ""} key={item.id}>
            <TableCell>
              <Link className="grid gap-1" href={`${ROUTES.ingredients}/${item.id}`}>
                <span className="font-semibold text-brand-espresso">{item.ingredientName}</span>
                <span className="text-xs text-brand-mocha">{item.ingredientCode}</span>
              </Link>
            </TableCell>
            <TableCell>{item.ingredientCategoryName}</TableCell>
            <TableCell>{item.supplierName ?? "Not linked"}</TableCell>
            <TableCell>
              {item.unitName} ({item.unitSymbol})
            </TableCell>
            <TableCell>{formatCurrency(item.costPerUnit)}</TableCell>
            <TableCell>
              <Badge variant="outline">{item.isStockTracked ? "Tracked" : "Not tracked"}</Badge>
            </TableCell>
            <TableCell>
              <Badge variant="outline">{item.isExpiryTracked ? "Tracked" : "Not tracked"}</Badge>
            </TableCell>
            <TableCell>
              {item.reorderLevel} {item.unitSymbol}
            </TableCell>
            <TableCell>
              <IngredientStatusBadge status={item.status} />
            </TableCell>
            <TableCell>{formatDate(item.createdAt)}</TableCell>
            <TableCell>
              <IngredientActionsMenu
                canManage={canManage}
                item={item}
                onDelete={onDelete}
                onEdit={onEdit}
                onStatusChange={onStatusChange}
                onView={(selectedItem) => router.push(`${ROUTES.ingredients}/${selectedItem.id}`)}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
