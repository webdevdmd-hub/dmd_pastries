"use client";

import type { JSX } from "react";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { SearchableCombobox } from "@/components/shared/searchable-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PERMISSIONS } from "@/constants/permissions";
import { useAllChartAccounts, useChartAccountOpenings } from "@/hooks/use-accounting";
import {
  useCounterpartyOpenings,
  useOpeningBalanceSummary,
  useSaveChartAccountOpening,
  useSaveCounterpartyOpening,
} from "@/hooks/use-accounting";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useCustomers } from "@/hooks/use-customers";
import { usePermission } from "@/hooks/use-permission";
import { useSuppliers } from "@/hooks/use-suppliers";
import { getErrorMessage } from "@/lib/api/client";
import type { CounterpartyOpening } from "@/types/accounting";

/**
 * Opening balances (Phase 6 / W1).
 *
 * Every opening posts against 3400 Opening Balance Equity, so the whole
 * screen is organised around driving that account to zero: enter what each
 * account, customer and supplier was carrying at go-live, and the unallocated
 * figure at the top counts down as you go.
 */

type PartyType = "customer" | "supplier";

function formatMoney(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ErrorNotice({ message }: { message: string }): JSX.Element {
  return (
    <div className="rounded-xl border border-danger/30 bg-danger-tint px-4 py-3 text-sm text-danger-text">
      {message}
    </div>
  );
}

function FieldLabel({ children, htmlFor }: { children: string; htmlFor?: string }): JSX.Element {
  // Some of these sit above a control and some above a read-only value.
  // Only the first kind is a label; the second renders as a caption so it
  // does not claim an association it does not have.
  return htmlFor ? (
    <label className="text-xs font-semibold text-muted-foreground" htmlFor={htmlFor}>
      {children}
    </label>
  ) : (
    <p className="text-xs font-semibold text-muted-foreground">{children}</p>
  );
}

export function OpeningBalancesPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const canView = hasAnyPermission([PERMISSIONS.accountingView]);
  const canManage = hasAnyPermission([PERMISSIONS.accountingAccountsManage]);
  const branchId = branchScope.effectiveBranchId ?? "";

  const [tab, setTab] = useState<"accounts" | "counterparties">("accounts");

  const summaryQuery = useOpeningBalanceSummary(branchId, canView);
  const openingsQuery = useChartAccountOpenings(branchId, canView && tab === "accounts");
  const accountsQuery = useAllChartAccounts(
    {
      accountGroup: "",
      accountType: "all",
      branchId,
      limit: 200,
      page: 1,
      parentAccountId: "",
      search: "",
      sortBy: "account_code",
      sortOrder: "asc",
      status: "active",
    },
    canView && tab === "accounts",
  );

  const [partyType, setPartyType] = useState<PartyType>("customer");
  const counterpartyQuery = useCounterpartyOpenings(
    branchId,
    partyType,
    canView && tab === "counterparties",
  );
  const customersQuery = useCustomers(
    { search: "", status: "all", tagId: "", dateFrom: "", dateTo: "" },
    canView && tab === "counterparties" && partyType === "customer",
  );
  const suppliersQuery = useSuppliers(
    { search: "", status: "all", country: "", missingTermsOnly: false },
    canView && tab === "counterparties" && partyType === "supplier",
  );

  const saveAccount = useSaveChartAccountOpening();
  const saveCounterparty = useSaveCounterpartyOpening();

  const [accountId, setAccountId] = useState("");
  const [accountAmount, setAccountAmount] = useState("");
  const [accountDate, setAccountDate] = useState("");
  const [partyId, setPartyId] = useState("");
  const [partyAmount, setPartyAmount] = useState("");
  const [partyDate, setPartyDate] = useState("");
  const [formError, setFormError] = useState("");

  const accountOptions = useMemo(
    () =>
      (accountsQuery.data ?? []).map((account) => ({
        value: account.id,
        label: `${account.accountCode} - ${account.accountName}`,
        description: `${account.accountType} / ${account.normalBalance}`,
        keywords: [account.accountCode, account.accountName, account.accountType],
      })),
    [accountsQuery.data],
  );

  const partyOptions = useMemo(() => {
    if (partyType === "supplier") {
      return (suppliersQuery.data?.items ?? []).map((supplier) => ({
        value: supplier.id,
        label: supplier.supplierName,
        keywords: [supplier.supplierName, supplier.supplierCode],
      }));
    }
    return (customersQuery.data ?? []).map((customer) => ({
      value: customer.id,
      label: customer.fullName,
      keywords: [customer.fullName, customer.phone ?? ""],
    }));
  }, [customersQuery.data, partyType, suppliersQuery.data]);

  if (!canView) {
    return <ErrorNotice message="You do not have permission to view accounting data." />;
  }
  if (!branchId) {
    return (
      <ErrorNotice message="Select a branch to enter opening balances. The chart of accounts is branch-scoped, so each branch opens its own books." />
    );
  }

  const submitAccountOpening = (): void => {
    setFormError("");
    if (!accountId || !accountDate) {
      setFormError("Choose an account and an as-of date.");
      return;
    }
    saveAccount.mutate(
      { amount: Number(accountAmount || "0"), chartAccountId: accountId, openingDate: accountDate },
      {
        onError: (error) => setFormError(getErrorMessage(error)),
        onSuccess: () => {
          setAccountId("");
          setAccountAmount("");
        },
      },
    );
  };

  const submitCounterpartyOpening = (): void => {
    setFormError("");
    if (!partyId || !partyDate) {
      setFormError(`Choose a ${partyType} and an as-of date.`);
      return;
    }
    saveCounterparty.mutate(
      { amount: Number(partyAmount || "0"), openingDate: partyDate, partyId, partyType },
      {
        onError: (error) => setFormError(getErrorMessage(error)),
        onSuccess: () => {
          setPartyId("");
          setPartyAmount("");
        },
      },
    );
  };

  const summary = summaryQuery.data;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="Opening Balances"
        description="Enter what each account, customer and supplier was carrying when this branch went live. Every entry books against 3400 Opening Balance Equity."
      />

      <Card className="border-workspace-panel-border bg-workspace-panel shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Opening Balance Equity (3400)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {summaryQuery.error ? (
            <ErrorNotice message={getErrorMessage(summaryQuery.error)} />
          ) : null}
          {summary ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-2xl font-semibold">
                  {formatMoney(summary.unallocatedOpeningEquity)}
                </span>
                <Badge variant={summary.isBalanced ? "secondary" : "outline"}>
                  {summary.isBalanced ? "Fully allocated" : "Unallocated"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {summary.isBalanced
                  ? "Every opening balance has been accounted for; 3400 is clear."
                  : "This is the part of the opening trial balance not yet entered. It should reach zero once every account, customer and supplier opening is in."}
              </p>
              <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <FieldLabel>Accounts</FieldLabel>
                  <p>{formatMoney(summary.chartAccountOpeningTotal)}</p>
                </div>
                <div>
                  <FieldLabel>Payment accounts</FieldLabel>
                  <p>{formatMoney(summary.paymentAccountOpeningTotal)}</p>
                </div>
                <div>
                  <FieldLabel>Customers</FieldLabel>
                  <p>{formatMoney(summary.customerOpeningTotal)}</p>
                </div>
                <div>
                  <FieldLabel>Suppliers</FieldLabel>
                  <p>{formatMoney(summary.supplierOpeningTotal)}</p>
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button
          onClick={() => setTab("accounts")}
          size="sm"
          type="button"
          variant={tab === "accounts" ? "default" : "outline"}
        >
          Accounts
        </Button>
        <Button
          onClick={() => setTab("counterparties")}
          size="sm"
          type="button"
          variant={tab === "counterparties" ? "default" : "outline"}
        >
          Customers &amp; Suppliers
        </Button>
      </div>

      {formError ? <ErrorNotice message={formError} /> : null}

      {tab === "accounts" ? (
        <Card className="border-workspace-panel-border bg-workspace-panel shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Account opening balances</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground">
              Cash and bank balances are set on the payment account itself, and inventory comes from
              opening stock, so those accounts are not offered here. Enter zero to remove an opening
              balance.
            </p>
            {canManage ? (
              <div className="grid gap-3 md:grid-cols-4">
                <div className="md:col-span-2">
                  <FieldLabel htmlFor="opening-balance-account">Account</FieldLabel>
                  <SearchableCombobox
                    id="opening-balance-account"
                    options={accountOptions}
                    placeholder="Select an account"
                    value={accountId}
                    onValueChange={setAccountId}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="opening-balance-amount">Amount</FieldLabel>
                  <Input
                    id="opening-balance-amount"
                    onChange={(event) => setAccountAmount(event.target.value)}
                    step="0.01"
                    type="number"
                    value={accountAmount}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="opening-balance-as-of">As of</FieldLabel>
                  <Input
                    id="opening-balance-as-of"
                    onChange={(event) => setAccountDate(event.target.value)}
                    type="date"
                    value={accountDate}
                  />
                </div>
                <div className="md:col-span-4">
                  <Button
                    disabled={saveAccount.isPending}
                    onClick={submitAccountOpening}
                    type="button"
                  >
                    {saveAccount.isPending ? "Saving..." : "Save opening balance"}
                  </Button>
                </div>
              </div>
            ) : null}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>As of</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(openingsQuery.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell className="text-sm text-muted-foreground" colSpan={3}>
                      No account opening balances entered yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  (openingsQuery.data ?? []).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        {row.accountCode} - {row.accountName}
                      </TableCell>
                      <TableCell>{row.openingDate}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.amount)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-workspace-panel-border bg-workspace-panel shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Customer and supplier opening balances</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground">
              A customer opening is what they owed the business at go-live, and a supplier opening
              is what the business owed them. These post to Accounts Receivable and Accounts
              Payable, and are included in that counterparty&apos;s outstanding balance.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setPartyType("customer");
                  setPartyId("");
                }}
                size="sm"
                type="button"
                variant={partyType === "customer" ? "default" : "outline"}
              >
                Customers
              </Button>
              <Button
                onClick={() => {
                  setPartyType("supplier");
                  setPartyId("");
                }}
                size="sm"
                type="button"
                variant={partyType === "supplier" ? "default" : "outline"}
              >
                Suppliers
              </Button>
            </div>
            {canManage ? (
              <div className="grid gap-3 md:grid-cols-4">
                <div className="md:col-span-2">
                  <FieldLabel htmlFor="opening-balance-partytype-supplier-supplier-custom">
                    {partyType === "supplier" ? "Supplier" : "Customer"}
                  </FieldLabel>
                  <SearchableCombobox
                    id="opening-balance-partytype-supplier-supplier-custom"
                    options={partyOptions}
                    placeholder={`Select a ${partyType}`}
                    value={partyId}
                    onValueChange={setPartyId}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="opening-balance-amount-2">Amount</FieldLabel>
                  <Input
                    id="opening-balance-amount-2"
                    onChange={(event) => setPartyAmount(event.target.value)}
                    step="0.01"
                    type="number"
                    value={partyAmount}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="opening-balance-as-of-2">As of</FieldLabel>
                  <Input
                    id="opening-balance-as-of-2"
                    onChange={(event) => setPartyDate(event.target.value)}
                    type="date"
                    value={partyDate}
                  />
                </div>
                <div className="md:col-span-4">
                  <Button
                    disabled={saveCounterparty.isPending}
                    onClick={submitCounterpartyOpening}
                    type="button"
                  >
                    {saveCounterparty.isPending ? "Saving..." : "Save opening balance"}
                  </Button>
                </div>
              </div>
            ) : null}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{partyType === "supplier" ? "Supplier" : "Customer"}</TableHead>
                  <TableHead>As of</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(counterpartyQuery.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell className="text-sm text-muted-foreground" colSpan={3}>
                      No {partyType} opening balances entered yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  (counterpartyQuery.data ?? []).map((row: CounterpartyOpening) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.partyName}</TableCell>
                      <TableCell>{row.openingDate}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.amount)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
