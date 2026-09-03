"use client";

import { Archive, MoreHorizontal, PackageSearch, Pencil, Power, Trash2 } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Product, ProductStatus } from "@/types/product";

type ProductActionsMenuProps = {
  canManage: boolean;
  onDelete: (product: Product) => void;
  onEdit: (product: Product) => void;
  onManageVariants: (product: Product) => void;
  onStatusChange: (product: Product, status: ProductStatus) => void;
  product: Product;
};

/**
 * Actions only. Viewing is the row's own click, so "View details" no longer
 * sits here; a reader with no manage rights sees no menu at all.
 */
export function ProductActionsMenu({
  canManage,
  onDelete,
  onEdit,
  onManageVariants,
  onStatusChange,
  product,
}: ProductActionsMenuProps): JSX.Element | null {
  const nextStatus: ProductStatus = product.status === "active" ? "inactive" : "active";

  if (!canManage) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Open actions for ${product.productName}`}
          size="icon"
          type="button"
          variant="ghost"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => onEdit(product)}>
            <Pencil className="h-4 w-4" />
            Edit product
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onManageVariants(product)}>
            <PackageSearch className="h-4 w-4" />
            Manage variants
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onStatusChange(product, nextStatus)}>
            <Power className="h-4 w-4" />
            {nextStatus === "active" ? "Activate" : "Deactivate"} product
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {product.status !== "archived" ? (
          <DropdownMenuItem onSelect={() => onStatusChange(product, "archived")}>
            <Archive className="h-4 w-4" />
            Archive product
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          className="text-danger-text focus:text-danger-text"
          onSelect={() => onDelete(product)}
        >
          <Trash2 className="h-4 w-4" />
          Delete product
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
