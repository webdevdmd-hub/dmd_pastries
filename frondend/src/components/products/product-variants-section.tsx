"use client";

import { Boxes, Pencil, Plus, Trash2 } from "lucide-react";
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
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-brand-cappuccino/70 bg-white/60">
        <div>
          <CardTitle className="text-lg">Variants</CardTitle>
          <p className="text-sm text-brand-mocha">
            Manage size, flavor, pack, or price options for this product.
          </p>
        </div>
        {canManage ? (
          <Button onClick={onAdd} size="sm">
            <Plus className="h-4 w-4" />
            Add variant
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        {variants.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-latte text-brand-mocha">
              <Boxes className="h-5 w-5" />
            </span>
            <p className="font-semibold text-brand-espresso">No variants yet</p>
            <p className="max-w-sm text-sm text-brand-mocha">
              Add variants when this product needs separate selling options such as Small, Large,
              500g, or 1kg.
            </p>
          </div>
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
                    <TableCell className="font-semibold text-brand-espresso">
                      {variant.variantName}
                    </TableCell>
                    <TableCell className="text-brand-mocha">{variant.sku ?? "-"}</TableCell>
                    <TableCell className="text-brand-mocha">{variant.barcode ?? "-"}</TableCell>
                    <TableCell>AED {variant.salePrice.toFixed(2)}</TableCell>
                    <TableCell>
                      {variant.costPrice === null ? "-" : `AED ${variant.costPrice.toFixed(2)}`}
                    </TableCell>
                    <TableCell>
                      <ProductStatusBadge status={variant.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {canManage ? (
                        <div className="inline-flex gap-2">
                          <Button onClick={() => onEdit(variant)} size="icon" variant="outline">
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit {variant.variantName}</span>
                          </Button>
                          <Button
                            className="text-red-700"
                            onClick={() => onDelete(variant)}
                            size="icon"
                            variant="outline"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete {variant.variantName}</span>
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
