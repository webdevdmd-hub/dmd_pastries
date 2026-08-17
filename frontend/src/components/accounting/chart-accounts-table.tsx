import { BookOpenText, Edit, MoreHorizontal, Power, Trash2 } from "lucide-react";
import type { JSX } from "react";

import {
  ChartAccountStatusBadge,
  ChartAccountTypeBadge,
} from "@/components/accounting/chart-account-badges";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import type { AccountingAccountStatus, ChartAccount } from "@/types/accounting";

type ChartAccountsTableProps = {
  accounts: ChartAccount[];
  canManage: boolean;
  onDelete: (account: ChartAccount) => void;
  onEdit: (account: ChartAccount) => void;
  onViewLedger: (account: ChartAccount) => void;
  onStatusChange: (account: ChartAccount, status: AccountingAccountStatus) => void;
};

function boolLabel(value: boolean): string {
  return value ? "Yes" : "No";
}

export function ChartAccountsTable({
  accounts,
  canManage,
  onDelete,
  onEdit,
  onViewLedger,
  onStatusChange,
}: ChartAccountsTableProps): JSX.Element {
  return (
    <div className="overflow-x-auto bg-card/75 [&>div]:rounded-none">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Account</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Group</TableHead>
            <TableHead>Normal</TableHead>
            <TableHead>Parent</TableHead>
            <TableHead>Manual</TableHead>
            <TableHead>System</TableHead>
            <TableHead>Status</TableHead>
            {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((account) => {
            const nextStatus: AccountingAccountStatus =
              account.status === "active" ? "inactive" : "active";
            const statusDisabled = account.isSystemAccount && nextStatus === "inactive";

            return (
              <TableRow key={account.id}>
                <TableCell>
                  <button
                    className="block text-left font-bold text-brand-espresso underline-offset-4 transition-colors hover:text-brand-mocha hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-caramel"
                    onClick={() => onViewLedger(account)}
                    type="button"
                  >
                    {account.accountCode} - {account.accountName}
                  </button>
                  {account.description ? (
                    <span className="block max-w-md truncate text-xs text-brand-mocha">
                      {account.description}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>
                  <ChartAccountTypeBadge accountType={account.accountType} />
                </TableCell>
                <TableCell className="text-brand-mocha">{account.accountGroup || "-"}</TableCell>
                <TableCell className="capitalize">{account.normalBalance}</TableCell>
                <TableCell>{account.parentAccountName || "-"}</TableCell>
                <TableCell>{boolLabel(account.allowManualPosting)}</TableCell>
                <TableCell>{account.isSystemAccount ? "Protected" : "Custom"}</TableCell>
                <TableCell>
                  <ChartAccountStatusBadge status={account.status} />
                </TableCell>
                {canManage ? (
                  <TableCell className="text-right">
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
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuLabel>Account actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => onViewLedger(account)}>
                          <BookOpenText className="h-4 w-4" />
                          Ledger details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(account)}>
                          <Edit className="h-4 w-4" />
                          Edit account
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={statusDisabled}
                          onClick={() => onStatusChange(account, nextStatus)}
                        >
                          <Power className="h-4 w-4" />
                          {nextStatus === "active" ? "Activate" : "Deactivate"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-danger-text focus:text-danger-text"
                          disabled={account.isSystemAccount}
                          onClick={() => onDelete(account)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete account
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                ) : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
