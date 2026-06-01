"use client";

import { Archive, Eye, MoreHorizontal, PackageSearch, Pencil, Power, Trash2 } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
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
        <DropdownMenuLabel>Product actions</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => onView(product)}>
            <Eye className="h-4 w-4" />
            View details
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {canManage ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => onEdit(product)}>
                <Pencil className="h-4 w-4" />
                Edit product
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onManageVariants(product)}>
                <PackageSearch className="h-4 w-4" />
                Manage variants
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange(product, nextStatus)}>
                <Power className="h-4 w-4" />
                {nextStatus === "active" ? "Activate" : "Deactivate"} product
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {product.status !== "archived" ? (
              <DropdownMenuItem onClick={() => onStatusChange(product, "archived")}>
                <Archive className="h-4 w-4" />
                Archive product
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              className="text-red-700 focus:text-red-800"
              onClick={() => onDelete(product)}
            >
              <Trash2 className="h-4 w-4" />
              Delete product
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
