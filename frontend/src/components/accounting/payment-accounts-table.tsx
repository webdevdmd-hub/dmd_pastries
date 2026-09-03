"use client";

import { MoreHorizontal, Trash2 } from "lucide-react";
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
import { PAYMENT_ACCOUNT_TYPE_LABELS, type PaymentAccount } from "@/types/accounting";

export type PaymentAccountsListProps = {
  accounts: PaymentAccount[];
  canManage: boolean;
  onDelete: (account: PaymentAccount) => void;
  onEdit: (account: PaymentAccount) => void;
  onStatusChange: (account: PaymentAccount, status: PaymentAccount["status"]) => void;
  /** Opens the account's details; the whole row is the target. */
  onView: (account: PaymentAccount) => void;
};

export function formatPaymentAccountMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

export function PaymentAccountStatusBadge({
  status,
}: {
  status: PaymentAccount["status"];
}): JSX.Element {
  return (
    <Badge variant={status === "active" ? "money" : "outline"}>
      {status === "active" ? "Active" : "Inactive"}
    </Badge>
  );
}

/** Actions only. Viewing is the row's own click. */
export function PaymentAccountActionsMenu({
  account,
  canManage,
  onDelete,
  onEdit,
  onStatusChange,
}: Omit<PaymentAccountsListProps, "accounts" | "onView"> & {
  account: PaymentAccount;
}): JSX.Element | null {
  if (!canManage) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Open actions for ${account.accountName}`}
          size="icon"
          type="button"
          variant="ghost"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onEdit(account)}>Edit</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={account.status === "active"}
          onSelect={() => onStatusChange(account, "active")}
        >
          Mark active
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={account.status === "inactive"}
          onSelect={() => onStatusChange(account, "inactive")}
        >
          Mark inactive
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-danger-text focus:text-danger-text"
          onSelect={() => onDelete(account)}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PaymentAccountsTable({
  accounts,
  canManage,
  onDelete,
  onEdit,
  onStatusChange,
  onView,
}: PaymentAccountsListProps): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Account</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Ledger</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead className="text-right">Balance</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {accounts.map((account) => (
          // The row opens the drawer; the name is also a button so the
          // keyboard has a focusable target for the same action.
          <TableRow className="cursor-pointer" key={account.id} onClick={() => onView(account)}>
            <TableCell>
              <button
                className="rounded-sm text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={(event) => {
                  event.stopPropagation();
                  onView(account);
                }}
                type="button"
              >
                {account.accountName}
              </button>
            </TableCell>
            <TableCell>{PAYMENT_ACCOUNT_TYPE_LABELS[account.accountType]}</TableCell>
            <TableCell>
              <span className="font-mono">{account.chartAccountCode}</span> ·{" "}
              {account.chartAccountName}
            </TableCell>
            <TableCell>{account.branchName || "Business-wide"}</TableCell>
            <TableCell className="text-right">
              <span className="grid gap-0.5">
                <span className="font-medium tabular-nums">
                  {formatPaymentAccountMoney(account.currentBalance)} {account.balanceLabel}
                </span>
                {account.openingBalance !== 0 ? (
                  <span className="text-meta tabular-nums text-foreground-muted">
                    Opening {formatPaymentAccountMoney(account.openingBalance)}
                    {account.openingBalanceDate ? ` as of ${account.openingBalanceDate}` : ""}
                  </span>
                ) : null}
              </span>
            </TableCell>
            <TableCell>
              <PaymentAccountStatusBadge status={account.status} />
            </TableCell>
            {/* The menu must not also open the drawer. */}
            <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
              <PaymentAccountActionsMenu
                account={account}
                canManage={canManage}
                onDelete={onDelete}
                onEdit={onEdit}
                onStatusChange={onStatusChange}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
