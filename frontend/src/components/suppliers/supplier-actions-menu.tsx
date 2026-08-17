"use client";

import { MoreHorizontal } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Supplier } from "@/types/supplier";

type SupplierActionsMenuProps = {
  canManage: boolean;
  onDelete: (supplier: Supplier) => void;
  onEdit: (supplier: Supplier) => void;
  onStatusChange: (supplier: Supplier, status: Supplier["status"]) => void;
  onView: (supplier: Supplier) => void;
  supplier: Supplier;
};

export function SupplierActionsMenu({
  canManage,
  onDelete,
  onEdit,
  onStatusChange,
  onView,
  supplier,
}: SupplierActionsMenuProps): JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Open actions for ${supplier.supplierName}`}
          size="icon"
          type="button"
          variant="ghost"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onView(supplier)}>View profile</DropdownMenuItem>
        {canManage ? (
          <>
            <DropdownMenuItem onSelect={() => onEdit(supplier)}>Edit supplier</DropdownMenuItem>
            <DropdownMenuSeparator />
            {supplier.status !== "active" ? (
              <DropdownMenuItem onSelect={() => onStatusChange(supplier, "active")}>
                Activate
              </DropdownMenuItem>
            ) : null}
            {supplier.status !== "inactive" ? (
              <DropdownMenuItem onSelect={() => onStatusChange(supplier, "inactive")}>
                Deactivate
              </DropdownMenuItem>
            ) : null}
            {supplier.status !== "blocked" ? (
              <DropdownMenuItem onSelect={() => onStatusChange(supplier, "blocked")}>
                Block
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-danger-text" onSelect={() => onDelete(supplier)}>
              Delete
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
