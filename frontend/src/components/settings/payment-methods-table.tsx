"use client";

import { MoreHorizontal } from "lucide-react";
import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatLabel } from "@/lib/format/label";
import type { PaymentMethod, RecordStatus } from "@/types/settings";

export type PaymentMethodsListProps = {
  canManage: boolean;
  methods: PaymentMethod[];
  onDeactivate: (method: PaymentMethod) => void;
  onEdit: (method: PaymentMethod) => void;
  onStatusChange: (method: PaymentMethod, status: RecordStatus) => void;
  /** Opens the method's details; the whole row is the target. */
  onView: (method: PaymentMethod) => void;
};

/** The modules a method can show in, in the order the badges render. */
export const PAYMENT_METHOD_MODULES: {
  key: keyof Pick<
    PaymentMethod,
    | "showInPos"
    | "showInBakeryOrders"
    | "showInPurchasing"
    | "showInExpenses"
    | "showInDashboardCollection"
  >;
  label: string;
}[] = [
  { key: "showInPos", label: "POS" },
  { key: "showInBakeryOrders", label: "Orders" },
  { key: "showInPurchasing", label: "Purchasing" },
  { key: "showInExpenses", label: "Expenses" },
  { key: "showInDashboardCollection", label: "Dashboard" },
];

/**
 * What the linked-account cell should say. A checkout-visible method with no
 * account is the one setup gap that blocks taking money, so it reads as a
 * problem rather than a dash.
 */
export function paymentMethodAccountState(method: PaymentMethod): {
  label: string;
  tone: "normal" | "danger" | "muted";
} {
  if (method.defaultPaymentAccountName) {
    return { label: method.defaultPaymentAccountName, tone: "normal" };
  }
  if (method.showInPos) {
    return { label: "Needs payment account", tone: "danger" };
  }
  if (method.showInBakeryOrders) {
    return { label: "Setup required", tone: "danger" };
  }
  return { label: "—", tone: "muted" };
}

export function PaymentMethodStatusBadge({ status }: { status: RecordStatus }): JSX.Element {
  return <Badge variant={status === "active" ? "money" : "outline"}>{formatLabel(status)}</Badge>;
}

export function PaymentMethodVisibilityBadges({ method }: { method: PaymentMethod }): JSX.Element {
  const visible = PAYMENT_METHOD_MODULES.filter((module) => method[module.key]);

  return (
    <div className="flex flex-wrap gap-1">
      {visible.length === 0 ? <span className="text-foreground-muted">Hidden</span> : null}
      {visible.map((module) => (
        <Badge key={module.key} variant="outline">
          {module.label}
        </Badge>
      ))}
    </div>
  );
}

/** Actions only. Viewing is the row's own click. */
export function PaymentMethodActionsMenu({
  canManage,
  method,
  onDeactivate,
  onEdit,
  onStatusChange,
}: Omit<PaymentMethodsListProps, "methods" | "onView"> & {
  method: PaymentMethod;
}): JSX.Element | null {
  if (!canManage) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Open actions for ${method.methodName}`}
          size="icon"
          type="button"
          variant="ghost"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onEdit(method)}>Edit method</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={method.status === "active"}
          onSelect={() => onStatusChange(method, "active")}
        >
          Activate
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={method.status === "inactive"}
          onSelect={() => onStatusChange(method, "inactive")}
        >
          Mark inactive
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-danger-text focus:text-danger-text"
          onSelect={() => onDeactivate(method)}
        >
          Deactivate through delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PaymentMethodsTable({
  canManage,
  methods,
  onDeactivate,
  onEdit,
  onStatusChange,
  onView,
}: PaymentMethodsListProps): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Default</TableHead>
          <TableHead>Split</TableHead>
          <TableHead>Reference</TableHead>
          <TableHead>Payment account</TableHead>
          <TableHead>Visible in</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {methods.map((method) => {
          const account = paymentMethodAccountState(method);

          return (
            // The row opens the drawer; the name is also a button so the
            // keyboard has a focusable target for the same action.
            <TableRow className="cursor-pointer" key={method.id} onClick={() => onView(method)}>
              <TableCell>
                <button
                  className="rounded-sm text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onClick={(event) => {
                    event.stopPropagation();
                    onView(method);
                  }}
                  type="button"
                >
                  {method.methodName}
                </button>
              </TableCell>
              <TableCell>{formatLabel(method.methodType)}</TableCell>
              <TableCell>{method.isDefault ? "Yes" : "No"}</TableCell>
              <TableCell>{method.allowSplitPayment ? "Allowed" : "No"}</TableCell>
              <TableCell>{method.requiresReference ? "Required" : "Optional"}</TableCell>
              <TableCell
                className={
                  account.tone === "danger"
                    ? "text-danger-text"
                    : account.tone === "muted"
                      ? "text-foreground-muted"
                      : undefined
                }
              >
                {account.label}
              </TableCell>
              <TableCell>
                <PaymentMethodVisibilityBadges method={method} />
              </TableCell>
              <TableCell>
                <PaymentMethodStatusBadge status={method.status} />
              </TableCell>
              {/* The menu must not also open the drawer. */}
              <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                <PaymentMethodActionsMenu
                  canManage={canManage}
                  method={method}
                  onDeactivate={onDeactivate}
                  onEdit={onEdit}
                  onStatusChange={onStatusChange}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
