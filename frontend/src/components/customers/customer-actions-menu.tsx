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
import type { Customer } from "@/types/customer";

type CustomerActionsMenuProps = {
  customer: Customer;
  canManage: boolean;
  onDelete: (customer: Customer) => void;
  onEdit: (customer: Customer) => void;
  onStatusChange: (customer: Customer, status: Customer["status"]) => void;
  onView: (customer: Customer) => void;
};

export function CustomerActionsMenu({
  customer,
  canManage,
  onDelete,
  onEdit,
  onStatusChange,
  onView,
}: CustomerActionsMenuProps): JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Open actions for ${customer.fullName}`}
          size="icon"
          type="button"
          variant="ghost"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onView(customer)}>View profile</DropdownMenuItem>
        {canManage ? (
          <>
            <DropdownMenuItem onSelect={() => onEdit(customer)}>Edit customer</DropdownMenuItem>
            <DropdownMenuSeparator />
            {customer.status !== "active" ? (
              <DropdownMenuItem onSelect={() => onStatusChange(customer, "active")}>
                Activate
              </DropdownMenuItem>
            ) : null}
            {customer.status !== "inactive" ? (
              <DropdownMenuItem onSelect={() => onStatusChange(customer, "inactive")}>
                Deactivate
              </DropdownMenuItem>
            ) : null}
            {customer.status !== "blocked" ? (
              <DropdownMenuItem onSelect={() => onStatusChange(customer, "blocked")}>
                Block
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-danger-text" onSelect={() => onDelete(customer)}>
              Delete
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
