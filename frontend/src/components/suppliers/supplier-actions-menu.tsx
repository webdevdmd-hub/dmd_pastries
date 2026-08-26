"use client";

import { MoreHorizontal } from "lucide-react";
import type { JSX } from "react";

import { SUPPLIER_STATUS_COPY } from "@/components/suppliers/supplier-status-copy";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Supplier, SupplierStatus } from "@/types/supplier";

/** The consequence each status change carries, in menu-item length. */
const STATUS_ACTIONS: { status: SupplierStatus; hint: string }[] = [
  { status: "active", hint: "Allows new orders and bills again." },
  { status: "inactive", hint: "Stops new POs. History stays." },
  { status: "blocked", hint: "Stops POs and new bills." },
];

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
            {/* Deactivate and Block used to sit here as two bare words with
                nothing saying how they differ or what either does to an open
                order. Both read as "stop using this supplier"; only one of
                them also stops billing. */}
            {STATUS_ACTIONS.filter((action) => action.status !== supplier.status).map((action) => (
              <DropdownMenuItem
                className="flex-col items-start gap-0.5"
                key={action.status}
                onSelect={() => onStatusChange(supplier, action.status)}
              >
                <span>{SUPPLIER_STATUS_COPY[action.status].verb}</span>
                <span className="text-meta text-foreground-muted">{action.hint}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="flex-col items-start gap-0.5 text-danger-text"
              onSelect={() => onDelete(supplier)}
            >
              <span>Delete</span>
              <span className="text-meta text-foreground-muted">
                Only if nothing references it.
              </span>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
