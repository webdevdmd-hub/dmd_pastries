"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import type { JSX } from "react";

import { ProductStatusBadge } from "@/components/products/product-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProductVariant } from "@/types/product";

type ProductVariantsSectionProps = {
  canManage: boolean;
  onAdd: () => void;
  onDelete: (variant: ProductVariant) => void;
  onEdit: (variant: ProductVariant) => void;
  variants: ProductVariant[];
};

export function ProductVariantsSection({
  canManage,
  onAdd,
  onDelete,
  onEdit,
  variants,
}: ProductVariantsSectionProps): JSX.Element {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Variants</CardTitle>
        {canManage ? (
          <Button onClick={onAdd} size="sm">
            <Plus className="h-4 w-4" />
            Add variant
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {variants.length === 0 ? (
          <p className="text-sm text-brand-mocha">No variants available for this product.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Variant</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Barcode</TableHead>
                  <TableHead>Sale price</TableHead>
                  <TableHead>Cost price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variants.map((variant) => (
                  <TableRow key={variant.id}>
                    <TableCell>{variant.variantName}</TableCell>
                    <TableCell>{variant.sku ?? "-"}</TableCell>
                    <TableCell>{variant.barcode ?? "-"}</TableCell>
                    <TableCell>{variant.salePrice.toFixed(2)}</TableCell>
                    <TableCell>{variant.costPrice?.toFixed(2) ?? "-"}</TableCell>
                    <TableCell>
                      <ProductStatusBadge status={variant.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {canManage ? (
                        <div className="inline-flex gap-2">
                          <Button onClick={() => onEdit(variant)} size="icon" variant="outline">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            className="text-red-700"
                            onClick={() => onDelete(variant)}
                            size="icon"
                            variant="outline"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
