"use client";

import { AlertTriangle, CheckCircle2, CreditCard, Landmark, Link2, Store } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PaymentAccountsPageClient } from "@/components/accounting/settlement-pages";
import { SettingsDataPageClient } from "@/components/settings/settings-data-page-client";
import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  useAccountingSetupReadiness,
  usePaymentAccounts,
  useSeedDefaultAccountMappings,
  useSeedDefaultPaymentAccounts,
} from "@/hooks/use-accounting";
import { usePermission } from "@/hooks/use-permission";
import { usePaymentMethods } from "@/hooks/use-settings-data";
import { getErrorMessage } from "@/lib/api/client";
import type {
  AccountingBackfillReadinessIssue,
  AccountingSetupReadinessResponse,
  PaymentAccount,
  PaymentAccountsFilters,
} from "@/types/accounting";
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

function readinessIssueBlocks(severity: string): boolean {
  return severity === "blocking" || severity === "error";
}

function isPaymentCoverageIssue(issue: AccountingBackfillReadinessIssue): boolean {
  return issue.code.startsWith("payment_method") || issue.code.startsWith("payment_account");
}

function isAccountMappingIssue(issue: AccountingBackfillReadinessIssue): boolean {
  return issue.code.startsWith("account_mapping");
}

function issueDetail(issue: AccountingBackfillReadinessIssue, key: string): string {
  const value = issue.details[key];
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function formatStatus(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatIssueDetails(issue: AccountingBackfillReadinessIssue): string {
  const detailLabels: [string, string][] = [
    ["method_name", "Payment method"],
    ["branch_name", "Branch"],
    ["payment_account_name", "Linked account"],
    ["payment_account_status", "Account status"],
    ["source", "Source"],
    ["chart_account_code", "Ledger code"],
    ["chart_account_name", "Ledger"],
    ["chart_account_status", "Ledger status"],
    ["mapping_key", "Mapping"],
    ["description", "Action"],
  ];
  const entries = detailLabels
    .map(([key, label]) => [label, issue.details[key]] as const)
    .filter(([, value]) => value !== "" && value !== null && value !== undefined);

  if (entries.length === 0) {
    return "";
  }

  return entries.map(([label, value]) => `${label}: ${String(value)}`).join(" | ");
}

function readinessAction(issue: AccountingBackfillReadinessIssue): {
  href: string;
  label: string;
} {
  if (issue.code.startsWith("account_mapping")) {
    return { href: ROUTES.accountingAccountMappings, label: "Open Account Mappings" };
  }
  if (issue.code.startsWith("payment_account")) {
    return { href: ROUTES.accountingPaymentAccounts, label: "Open Payment Accounts" };
  }
  return { href: `${ROUTES.settingsPaymentSetup}?tab=methods`, label: "Open Payment Methods" };
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
  canManageAccounts,
  isSetupReadinessLoading,
  isSeedingPaymentAccounts,
  isSeedingAccountMappings,
  methods,
  methodsError,
  onSeedPaymentAccounts,
  onSeedAccountMappings,
  seedPaymentAccountsError,
  seedAccountMappingsError,
  setupReadiness,
  setupReadinessError,
}: {
  accounts: PaymentAccount[];
  accountsError: Error | null;
  canViewAccounts: boolean;
  canViewMethods: boolean;
  canManageAccounts: boolean;
  isSetupReadinessLoading: boolean;
  isSeedingPaymentAccounts: boolean;
  isSeedingAccountMappings: boolean;
  methods: PaymentMethod[];
  methodsError: Error | null;
  onSeedPaymentAccounts: () => void;
  onSeedAccountMappings: () => void;
  seedPaymentAccountsError: Error | null;
  seedAccountMappingsError: Error | null;
  setupReadiness: AccountingSetupReadinessResponse | undefined;
  setupReadinessError: Error | null;
}): JSX.Element {
  const activeMethods = methods.filter((method) => method.status === "active");
  const activeAccounts = accounts.filter((account) => account.status === "active");
  const setupIssues = setupReadiness?.issues ?? [];
  const blockingSetupIssues = setupIssues.filter((issue) => readinessIssueBlocks(issue.severity));
  const blockingPaymentCoverageIssues = blockingSetupIssues.filter(isPaymentCoverageIssue);
  const blockingAccountMappingIssues = blockingSetupIssues.filter(isAccountMappingIssue);
  const setupIssueCount = canViewAccounts ? blockingSetupIssues.length : 0;

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
          tone={setupIssueCount > 0 ? "warning" : "success"}
          value={canViewAccounts ? String(setupIssueCount) : "-"}
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

      {setupReadinessError ? (
        <Alert className="border-red-200 bg-red-50 text-red-950">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Unable to load accounting setup readiness</AlertTitle>
          <AlertDescription>{getErrorMessage(setupReadinessError)}</AlertDescription>
        </Alert>
      ) : null}

      {seedPaymentAccountsError ? (
        <Alert className="border-red-200 bg-red-50 text-red-950">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Unable to set up default payment accounts</AlertTitle>
          <AlertDescription>{getErrorMessage(seedPaymentAccountsError)}</AlertDescription>
        </Alert>
      ) : null}

      {seedAccountMappingsError ? (
        <Alert className="border-red-200 bg-red-50 text-red-950">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Unable to set up default account mappings</AlertTitle>
          <AlertDescription>{getErrorMessage(seedAccountMappingsError)}</AlertDescription>
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

      {!canViewAccounts ? (
        <AccessNotice title="Accounting access is required to verify readiness" />
      ) : isSetupReadinessLoading ? (
        <Alert>
          <AlertTitle>Checking payment and accounting setup</AlertTitle>
          <AlertDescription>Loading the backend readiness check.</AlertDescription>
        </Alert>
      ) : blockingSetupIssues.length > 0 ? (
        <Card className="border-red-200">
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle className="text-red-950">Accounting setup issues</CardTitle>
              {canManageAccounts && blockingPaymentCoverageIssues.length > 0 ? (
                <Button
                  disabled={isSeedingPaymentAccounts}
                  onClick={onSeedPaymentAccounts}
                  type="button"
                >
                  {isSeedingPaymentAccounts
                    ? "Setting up accounts..."
                    : "Set up default payment accounts"}
                </Button>
              ) : null}
              {canManageAccounts && blockingAccountMappingIssues.length > 0 ? (
                <Button
                  disabled={isSeedingAccountMappings}
                  onClick={onSeedAccountMappings}
                  type="button"
                >
                  {isSeedingAccountMappings
                    ? "Setting up mappings..."
                    : "Set up default account mappings"}
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {blockingSetupIssues.map((issue) => {
              const action = readinessAction(issue);
              const details = formatIssueDetails(issue);

              return (
                <div
                  className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-950"
                  key={`${issue.code}-${issue.message}-${details}`}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-semibold">{issue.message}</p>
                      {details ? <p className="mt-1 text-xs text-red-800">{details}</p> : null}
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link href={action.href}>{action.label}</Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : setupReadiness?.ready ? (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-950">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Payment setup is ready</AlertTitle>
          <AlertDescription>
            Payment methods, payment accounts, branch mappings, ledgers, and required account
            mappings are ready for operational accounting.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function BranchMappingView({
  canViewAccounts,
  canViewMethods,
  setupReadiness,
}: {
  canViewAccounts: boolean;
  canViewMethods: boolean;
  setupReadiness: AccountingSetupReadinessResponse | undefined;
}): JSX.Element {
  if (!canViewMethods) {
    return <AccessNotice title="Payment method access is required" />;
  }

  const branchPaymentIssues = (setupReadiness?.issues ?? []).filter(
    (issue) => readinessIssueBlocks(issue.severity) && isPaymentCoverageIssue(issue),
  );

  return (
    <div className="flex flex-col gap-6">
      {!canViewAccounts ? (
        <AccessNotice title="Accounting access is required to verify linked accounts" />
      ) : null}
      {canViewAccounts && branchPaymentIssues.length > 0 ? (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-950">Branch checkout mapping issues</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Effective Account</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Issue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branchPaymentIssues.map((issue) => {
                  const methodName = issueDetail(issue, "method_name") || "Payment method";
                  const branchName = issueDetail(issue, "branch_name") || "Branch";
                  const accountName = issueDetail(issue, "payment_account_name");
                  const source = issueDetail(issue, "source");

                  return (
                    <TableRow
                      key={`${issue.code}-${issueDetail(issue, "payment_method_id")}-${issueDetail(
                        issue,
                        "branch_id",
                      )}-${accountName}`}
                    >
                      <TableCell>
                        <div className="font-medium text-brand-espresso">{methodName}</div>
                        <div className="text-xs text-brand-mocha">
                          {issueDetail(issue, "method_type")}
                        </div>
                      </TableCell>
                      <TableCell>{branchName}</TableCell>
                      <TableCell>
                        {accountName ? (
                          <>
                            <div>{accountName}</div>
                            <div className="text-xs text-brand-mocha">
                              {issueDetail(issue, "chart_account_code")}{" "}
                              {issueDetail(issue, "chart_account_name")}
                            </div>
                          </>
                        ) : (
                          <span className="text-red-700">No effective account</span>
                        )}
                      </TableCell>
                      <TableCell>{source ? formatStatus(source) : "-"}</TableCell>
                      <TableCell className="text-red-700">{issue.message}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : canViewAccounts && setupReadiness?.ready ? (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-950">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Branch checkout mappings are ready</AlertTitle>
          <AlertDescription>
            Active operational payment methods resolve to active payment accounts for every active
            branch.
          </AlertDescription>
        </Alert>
      ) : canViewAccounts && setupReadiness ? (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>No branch payment mapping issues</AlertTitle>
          <AlertDescription>
            Backend readiness reported no blocking branch payment account issues. Review non-payment
            accounting setup issues from the Overview tab.
          </AlertDescription>
        </Alert>
      ) : null}
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
  const canManageAccounts = hasAnyPermission([PERMISSIONS.accountingAccountsManage]);
  const canViewAny = canViewMethods || canViewAccounts;
  const methodsQuery = usePaymentMethods(canViewMethods);
  const accountsQuery = usePaymentAccounts(overviewAccountFilters, canViewAccounts);
  const setupReadinessQuery = useAccountingSetupReadiness(canViewAccounts);
  const seedPaymentAccountsMutation = useSeedDefaultPaymentAccounts();
  const seedAccountMappingsMutation = useSeedDefaultAccountMappings();

  const methods = methodsQuery.data ?? [];
  const accounts = accountsQuery.data?.items ?? [];
  const visibleTabs = useMemo(() => tabs, []);

  const selectTab = (tab: PaymentSetupTab): void => {
    setActiveTab(tab);
    router.replace(`${ROUTES.settingsPaymentSetup}?tab=${tab}`, { scroll: false });
  };

  const handleSeedPaymentAccounts = async (): Promise<void> => {
    try {
      const result = await seedPaymentAccountsMutation.mutateAsync();
      await Promise.all([
        methodsQuery.refetch(),
        accountsQuery.refetch(),
        setupReadinessQuery.refetch(),
      ]);
      toast.success("Default payment accounts are ready.", {
        description: [
          String(result.createdPaymentAccounts),
          " created, ",
          String(result.linkedPaymentMethods),
          " linked.",
        ].join(""),
      });
    } catch (error) {
      toast.error("Unable to set up default payment accounts.", {
        description: getErrorMessage(error),
      });
    }
  };

  const handleSeedAccountMappings = async (): Promise<void> => {
    try {
      await seedAccountMappingsMutation.mutateAsync();
      await setupReadinessQuery.refetch();
      toast.success("Default account mappings are ready.");
    } catch (error) {
      toast.error("Unable to set up default account mappings.", {
        description: getErrorMessage(error),
      });
    }
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
          canManageAccounts={canManageAccounts}
          isSetupReadinessLoading={setupReadinessQuery.isLoading}
          isSeedingPaymentAccounts={seedPaymentAccountsMutation.isPending}
          isSeedingAccountMappings={seedAccountMappingsMutation.isPending}
          methods={methods}
          methodsError={methodsQuery.error}
          onSeedPaymentAccounts={() => {
            void handleSeedPaymentAccounts();
          }}
          onSeedAccountMappings={() => {
            void handleSeedAccountMappings();
          }}
          seedPaymentAccountsError={seedPaymentAccountsMutation.error}
          seedAccountMappingsError={seedAccountMappingsMutation.error}
          setupReadiness={setupReadinessQuery.data}
          setupReadinessError={setupReadinessQuery.error}
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
          canViewAccounts={canViewAccounts}
          canViewMethods={canViewMethods}
          setupReadiness={setupReadinessQuery.data}
        />
      ) : null}
    </div>
  );
}
