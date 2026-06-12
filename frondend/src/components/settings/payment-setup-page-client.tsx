"use client";

import { AlertTriangle, CheckCircle2, CreditCard, Landmark, Link2, Store } from "lucide-react";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useMemo, useState } from "react";

import { PaymentAccountsPageClient } from "@/components/accounting/settlement-pages";
import { SettingsDataPageClient } from "@/components/settings/settings-data-page-client";
import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { usePaymentAccounts } from "@/hooks/use-accounting";
import { usePermission } from "@/hooks/use-permission";
import { usePaymentMethods } from "@/hooks/use-settings-data";
import { getErrorMessage } from "@/lib/api/client";
import type { PaymentAccount, PaymentAccountsFilters } from "@/types/accounting";
import type { PaymentMethod } from "@/types/settings";

type PaymentSetupTab = "overview" | "methods" | "accounts" | "branches";

type PaymentSetupPageClientProps = {
  initialTab: PaymentSetupTab;
};

const tabs: { label: string; value: PaymentSetupTab }[] = [
  { label: "Overview", value: "overview" },
  { label: "Methods", value: "methods" },
  { label: "Accounts", value: "accounts" },
  { label: "Branch setup", value: "branches" },
];

const overviewAccountFilters: PaymentAccountsFilters = {
  accountType: "all",
  branchId: "",
  limit: 100,
  page: 1,
  search: "",
  sortBy: "account_name",
  sortOrder: "asc",
  status: "all",
};

function setupIssueCount(methods: PaymentMethod[], accounts: PaymentAccount[]): number {
  const accountsById = new Map(accounts.map((account) => [account.id, account]));

  return methods.filter((method) => {
    if (method.status !== "active" || (!method.showInPos && !method.showInBakeryOrders)) {
      return false;
    }

    const linkedAccount = method.defaultPaymentAccountId
      ? accountsById.get(method.defaultPaymentAccountId)
      : null;

    return linkedAccount?.status !== "active";
  }).length;
}

function money(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
}

function OverviewCard({
  detail,
  icon,
  label,
  tone = "neutral",
  value,
}: {
  detail: string;
  icon: JSX.Element;
  label: string;
  tone?: "neutral" | "warning" | "success";
  value: string;
}): JSX.Element {
  const toneClass =
    tone === "warning"
      ? "border-red-200 bg-red-50 text-red-950"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-950"
        : "border-workspace-border bg-workspace-panel text-brand-espresso";

  return (
    <Card className={toneClass}>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-current/70">
            {label}
          </p>
          <p className="mt-3 text-3xl font-semibold">{value}</p>
          <p className="mt-2 text-sm text-current/70">{detail}</p>
        </div>
        <div className="rounded-full border border-current/15 bg-white/60 p-3">{icon}</div>
      </CardContent>
    </Card>
  );
}

function AccessNotice({ title }: { title: string }): JSX.Element {
  return (
    <Alert>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        You can view this unified setup page, but this section needs the matching Settings or
        Accounting permission before it can load data.
      </AlertDescription>
    </Alert>
  );
}

function PaymentSetupOverview({
  accounts,
  accountsError,
  canViewAccounts,
  canViewMethods,
  methods,
  methodsError,
}: {
  accounts: PaymentAccount[];
  accountsError: Error | null;
  canViewAccounts: boolean;
  canViewMethods: boolean;
  methods: PaymentMethod[];
  methodsError: Error | null;
}): JSX.Element {
  const activeMethods = methods.filter((method) => method.status === "active");
  const activeAccounts = accounts.filter((account) => account.status === "active");
  const issueCount = setupIssueCount(methods, accounts);
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const blockedMethods = activeMethods.filter((method) => {
    if (!method.showInPos && !method.showInBakeryOrders) return false;
    const account = method.defaultPaymentAccountId
      ? accountsById.get(method.defaultPaymentAccountId)
      : null;
    return account?.status !== "active";
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OverviewCard
          detail="Active ways customers can pay."
          icon={<CreditCard className="h-5 w-5" />}
          label="Payment methods"
          value={canViewMethods ? String(activeMethods.length) : "-"}
        />
        <OverviewCard
          detail="Active places where money is recorded."
          icon={<Landmark className="h-5 w-5" />}
          label="Payment accounts"
          value={canViewAccounts ? String(activeAccounts.length) : "-"}
        />
        <OverviewCard
          detail="Checkout-visible methods missing a usable linked account."
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Setup warnings"
          tone={issueCount > 0 ? "warning" : "success"}
          value={canViewMethods && canViewAccounts ? String(issueCount) : "-"}
        />
        <OverviewCard
          detail="Business-wide and branch-specific account records."
          icon={<Store className="h-5 w-5" />}
          label="Branch coverage"
          value={canViewAccounts ? String(accounts.length) : "-"}
        />
      </div>

      {methodsError ? (
        <Alert className="border-red-200 bg-red-50 text-red-950">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Unable to load payment methods</AlertTitle>
          <AlertDescription>{getErrorMessage(methodsError)}</AlertDescription>
        </Alert>
      ) : null}

      {accountsError ? (
        <Alert className="border-red-200 bg-red-50 text-red-950">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Unable to load payment accounts</AlertTitle>
          <AlertDescription>{getErrorMessage(accountsError)}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            How payment setup works
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-workspace-border p-4">
            <p className="font-semibold text-brand-espresso">1. Payment method</p>
            <p className="mt-2 text-sm text-brand-mocha">
              This is what the user selects at checkout, such as Cash, Card, Talabat, or Bank
              Transfer.
            </p>
          </div>
          <div className="rounded-2xl border border-workspace-border p-4">
            <p className="font-semibold text-brand-espresso">2. Linked payment account</p>
            <p className="mt-2 text-sm text-brand-mocha">
              This is where the money is held and reconciled, such as Cash Box, Card Clearing, or
              Talabat Settlement.
            </p>
          </div>
          <div className="rounded-2xl border border-workspace-border p-4">
            <p className="font-semibold text-brand-espresso">3. Accounting ledger</p>
            <p className="mt-2 text-sm text-brand-mocha">
              Payment accounts connect to asset ledgers so reports, journals, and reconciliation
              stay accurate.
            </p>
          </div>
        </CardContent>
      </Card>

      {blockedMethods.length > 0 ? (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-950">Checkout setup warnings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {blockedMethods.map((method) => (
              <div
                className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-950"
                key={method.id}
              >
                <span className="font-semibold">{method.methodName}</span> is visible in checkout
                but does not have an active linked payment account.
              </div>
            ))}
          </CardContent>
        </Card>
      ) : canViewMethods && canViewAccounts ? (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-950">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Payment setup is ready</AlertTitle>
          <AlertDescription>
            Active checkout methods have usable linked payment accounts.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function BranchMappingView({
  accounts,
  canViewAccounts,
  canViewMethods,
  methods,
}: {
  accounts: PaymentAccount[];
  canViewAccounts: boolean;
  canViewMethods: boolean;
  methods: PaymentMethod[];
}): JSX.Element {
  if (!canViewMethods) {
    return <AccessNotice title="Payment method access is required" />;
  }

  const accountsById = new Map(accounts.map((account) => [account.id, account]));

  return (
    <div className="flex flex-col gap-6">
      {!canViewAccounts ? (
        <AccessNotice title="Accounting access is required to verify linked accounts" />
      ) : null}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment Method</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Linked Account</TableHead>
                <TableHead>Account Branch</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {methods.map((method) => {
                const linkedAccount = method.defaultPaymentAccountId
                  ? accountsById.get(method.defaultPaymentAccountId)
                  : null;
                const ready = method.status === "active" && linkedAccount?.status === "active";

                return (
                  <TableRow key={method.id}>
                    <TableCell>
                      <div className="font-medium text-brand-espresso">{method.methodName}</div>
                      <div className="text-xs text-brand-mocha">{method.methodType}</div>
                    </TableCell>
                    <TableCell>{method.branchName ?? "Business-wide"}</TableCell>
                    <TableCell>
                      {linkedAccount ? (
                        <>
                          <div>{linkedAccount.accountName}</div>
                          <div className="text-xs text-brand-mocha">
                            {money(linkedAccount.currentBalance)} {linkedAccount.balanceLabel}
                          </div>
                        </>
                      ) : (
                        <span className="text-red-700">No linked account</span>
                      )}
                    </TableCell>
                    <TableCell>{linkedAccount?.branchName ?? "Business-wide"}</TableCell>
                    <TableCell>
                      <Badge variant={ready ? "secondary" : "default"}>
                        {ready ? "Ready" : "Needs setup"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {methods.length === 0 ? (
                <TableRow>
                  <TableCell className="py-12 text-center text-brand-mocha" colSpan={5}>
                    No payment methods found.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export function PaymentSetupPageClient({ initialTab }: PaymentSetupPageClientProps): JSX.Element {
  const router = useRouter();
  const { hasAnyPermission } = usePermission();
  const [activeTab, setActiveTab] = useState<PaymentSetupTab>(initialTab);
  const canViewMethods = hasAnyPermission([
    PERMISSIONS.settingsView,
    PERMISSIONS.settingsPaymentMethodsManage,
  ]);
  const canViewAccounts = hasAnyPermission([
    PERMISSIONS.accountingView,
    PERMISSIONS.accountingAccountsManage,
  ]);
  const canViewAny = canViewMethods || canViewAccounts;
  const methodsQuery = usePaymentMethods(canViewMethods);
  const accountsQuery = usePaymentAccounts(overviewAccountFilters, canViewAccounts);

  const methods = methodsQuery.data ?? [];
  const accounts = accountsQuery.data?.items ?? [];
  const visibleTabs = useMemo(() => tabs, []);

  const selectTab = (tab: PaymentSetupTab): void => {
    setActiveTab(tab);
    router.replace(`${ROUTES.settingsPaymentSetup}?tab=${tab}`, { scroll: false });
  };

  if (!canViewAny) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <PageHeader
          title="Payment Methods & Accounts"
          description="Choose how customers pay, then link where that money is recorded."
        />
        <AccessNotice title="Payment setup access is required" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Payment Methods & Accounts"
        description="Choose how customers pay, then link where that money is recorded."
      />

      <div className="flex flex-wrap gap-2 rounded-2xl border border-workspace-border bg-workspace-panel p-2">
        {visibleTabs.map((tab) => (
          <Button
            aria-current={activeTab === tab.value ? "page" : undefined}
            key={tab.value}
            onClick={() => selectTab(tab.value)}
            size="sm"
            variant={activeTab === tab.value ? "default" : "ghost"}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === "overview" ? (
        <PaymentSetupOverview
          accounts={accounts}
          accountsError={accountsQuery.error}
          canViewAccounts={canViewAccounts}
          canViewMethods={canViewMethods}
          methods={methods}
          methodsError={methodsQuery.error}
        />
      ) : null}

      {activeTab === "methods" ? (
        canViewMethods ? (
          <SettingsDataPageClient embedded kind="payment-methods" />
        ) : (
          <AccessNotice title="Payment method access is required" />
        )
      ) : null}

      {activeTab === "accounts" ? (
        canViewAccounts ? (
          <PaymentAccountsPageClient embedded />
        ) : (
          <AccessNotice title="Accounting access is required" />
        )
      ) : null}

      {activeTab === "branches" ? (
        <BranchMappingView
          accounts={accounts}
          canViewAccounts={canViewAccounts}
          canViewMethods={canViewMethods}
          methods={methods}
        />
      ) : null}
    </div>
  );
}
