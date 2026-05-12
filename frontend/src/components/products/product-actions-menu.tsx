"use client";

import { MoreHorizontal } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Product, ProductStatus } from "@/types/product";

type ProductActionsMenuProps = {
  canManage: boolean;
  onDelete: (product: Product) => void;
  onEdit: (product: Product) => void;
  onManageVariants: (product: Product) => void;
  onStatusChange: (product: Product, status: ProductStatus) => void;
  onView: (product: Product) => void;
  product: Product;
};

export function ProductActionsMenu({
  canManage,
  onDelete,
  onEdit,
  onManageVariants,
  onStatusChange,
  onView,
  product,
}: ProductActionsMenuProps): JSX.Element {
  const nextStatus: ProductStatus = product.status === "active" ? "inactive" : "active";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label={`Open actions for ${product.productName}`} size="icon" variant="ghost">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => onView(product)}>View details</DropdownMenuItem>
        {canManage ? (
          <>
            <DropdownMenuItem onClick={() => onEdit(product)}>Edit product</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onManageVariants(product)}>
              Manage variants
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange(product, nextStatus)}>
              {nextStatus === "active" ? "Activate" : "Deactivate"} product
            </DropdownMenuItem>
            {product.status !== "archived" ? (
              <DropdownMenuItem onClick={() => onStatusChange(product, "archived")}>
                Archive product
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem className="text-red-700" onClick={() => onDelete(product)}>
              Delete product
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
