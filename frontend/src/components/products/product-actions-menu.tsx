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
import { type ProductPermissions, productRowActions } from "@/lib/products/product-actions";
import type { Product, ProductStatus } from "@/types/product";

type ProductActionsMenuProps = {
  onDelete: (product: Product) => void;
  onEdit: (product: Product) => void;
  onManageVariants: (product: Product) => void;
  onStatusChange: (product: Product, status: ProductStatus) => void;
  permissions: ProductPermissions;
  product: Product;
};

/**
 * Actions only. Viewing is the row's own click, so "View details" no longer
 * sits here; a reader with no product rights sees no menu at all, and each
 * item shows only for the permission its route checks (ISSUE-065).
 */
export function ProductActionsMenu({
  onDelete,
  onEdit,
  onManageVariants,
  onStatusChange,
  permissions,
  product,
}: ProductActionsMenuProps): JSX.Element | null {
  const nextStatus: ProductStatus = product.status === "active" ? "inactive" : "active";
  const actions = productRowActions(permissions, product.status);
  const offers = (action: (typeof actions)[number]): boolean => actions.includes(action);
  const hasEditGroup = offers("edit") || offers("variants") || offers("status");
  const hasRemoveGroup = offers("archive") || offers("delete");

  if (actions.length === 0) {
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
        {hasEditGroup ? (
          <DropdownMenuGroup>
            {offers("edit") ? (
              <DropdownMenuItem onSelect={() => onEdit(product)}>
                <Pencil className="h-4 w-4" />
                Edit product
              </DropdownMenuItem>
            ) : null}
            {offers("variants") ? (
              <DropdownMenuItem onSelect={() => onManageVariants(product)}>
                <PackageSearch className="h-4 w-4" />
                Manage variants
              </DropdownMenuItem>
            ) : null}
            {offers("status") ? (
              <DropdownMenuItem onSelect={() => onStatusChange(product, nextStatus)}>
                <Power className="h-4 w-4" />
                {nextStatus === "active" ? "Activate" : "Deactivate"} product
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
        ) : null}
        {hasEditGroup && hasRemoveGroup ? <DropdownMenuSeparator /> : null}
        {offers("archive") ? (
          <DropdownMenuItem onSelect={() => onStatusChange(product, "archived")}>
            <Archive className="h-4 w-4" />
            Archive product
          </DropdownMenuItem>
        ) : null}
        {offers("delete") ? (
          <DropdownMenuItem
            className="text-danger-text focus:text-danger-text"
            onSelect={() => onDelete(product)}
          >
            <Trash2 className="h-4 w-4" />
            Delete product
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
