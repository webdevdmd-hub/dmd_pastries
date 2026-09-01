"use client";

import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useMemo } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/settings/access-denied-card";
import { SettingsEmptyState } from "@/components/settings/settings-empty-state";
import { SettingsGrid } from "@/components/settings/settings-grid";
import { SettingsSkeleton } from "@/components/settings/settings-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { SETTINGS_SECTIONS } from "@/constants/settings";
import { useAuth } from "@/hooks/use-auth";
import { useMasterDataOverview } from "@/hooks/use-master-data";
import { usePermission } from "@/hooks/use-permission";
import { useSettingsOverview } from "@/hooks/use-settings-data";
import type { SettingsSection } from "@/types/settings";

function isSystemSection(section: SettingsSection): boolean {
  return section.category === "system";
}

function isMasterDataSection(section: SettingsSection): boolean {
  return section.category === "master_data";
}

export function SettingsPageClient(): JSX.Element {
  const router = useRouter();
  const { status } = useAuth();
  const { hasAnyPermission, hasPermission } = usePermission();
  const canViewSettings = hasPermission(PERMISSIONS.settingsView);
  const canManageSettings = hasAnyPermission([
    PERMISSIONS.settingsCompanyUpdate,
    PERMISSIONS.settingsTaxRatesManage,
    PERMISSIONS.settingsPaymentMethodsManage,
    PERMISSIONS.settingsReceiptUpdate,
    PERMISSIONS.settingsHardwareUpdate,
    PERMISSIONS.settingsNotificationsUpdate,
  ]);
  const canViewMasterData = hasPermission(PERMISSIONS.masterDataView);
  const canManageMasterData = hasAnyPermission([
    PERMISSIONS.masterDataUnitsManage,
    PERMISSIONS.masterDataProductCategoriesManage,
    PERMISSIONS.masterDataIngredientCategoriesManage,
    PERMISSIONS.masterDataPackagingCategoriesManage,
    PERMISSIONS.masterDataOrderStatusesManage,
    PERMISSIONS.masterDataPaymentStatusesManage,
  ]);
  const settingsOverviewQuery = useSettingsOverview(canViewSettings);
  const masterDataOverviewQuery = useMasterDataOverview(canViewMasterData);

  const systemSections = useMemo(
    () =>
      SETTINGS_SECTIONS.filter((section) => isSystemSection(section)).filter((section) =>
        hasPermission(section.permission),
      ),
    [hasPermission],
  );
  const masterDataSections = useMemo(
    () =>
      SETTINGS_SECTIONS.filter((section) => isMasterDataSection(section)).filter((section) =>
        hasPermission(section.permission),
      ),
    [hasPermission],
  );

  const handleOpenSection = (section: SettingsSection): void => {
    if (section.status === "available") {
      router.push(section.route);
      return;
    }

    if (section.status === "coming_soon") {
      toast.info("This section is prepared for the next development phase.");
      return;
    }

    toast.info("This section is prepared for the next development phase.");
  };

  const canManageSection = (section: SettingsSection): boolean => {
    return hasPermission(section.managePermission);
  };

  if (status === "loading") {
    return (
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <PageHeader
          title="Settings"
          description="Configure your business, financial rules, master data, users, and operational preferences."
        />
        <SettingsSkeleton />
      </div>
    );
  }

  if (!canViewSettings) {
    return <AccessDeniedCard />;
  }

  const hasVisibleSections = systemSections.length > 0 || masterDataSections.length > 0;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8">
      <PageHeader
        title="Settings"
        description="Configure your business, financial rules, master data, users, and operational preferences."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-brand-mocha">Company Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-kpi tabular-nums text-foreground">
              {settingsOverviewQuery.data?.companyProfileCompleted ? "Complete" : "Pending"}
            </p>
            <p className="mt-1 text-sm text-brand-mocha">
              {settingsOverviewQuery.data?.defaultCurrency ?? "Currency"} ·{" "}
              {settingsOverviewQuery.data?.defaultTimezone ?? "Timezone"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-brand-mocha">Branches</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-kpi tabular-nums text-foreground">
              {settingsOverviewQuery.data?.branchCount ?? 0}
            </p>
            <p className="mt-1 text-sm text-brand-mocha">Configured locations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-brand-mocha">Tax & Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-kpi tabular-nums text-foreground">
              {(settingsOverviewQuery.data?.activeTaxRatesCount ?? 0) +
                (settingsOverviewQuery.data?.activePaymentMethodsCount ?? 0)}
            </p>
            <p className="mt-1 text-sm text-brand-mocha">Active financial records</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-brand-mocha">Master Data</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-kpi tabular-nums text-foreground">
              {masterDataOverviewQuery.data
                ? masterDataOverviewQuery.data.unitsCount +
                  masterDataOverviewQuery.data.productCategoriesCount +
                  masterDataOverviewQuery.data.ingredientCategoriesCount +
                  masterDataOverviewQuery.data.packagingCategoriesCount +
                  masterDataOverviewQuery.data.orderStatusesCount +
                  masterDataOverviewQuery.data.paymentStatusesCount
                : 0}
            </p>
            <p className="mt-1 text-sm text-brand-mocha">Seeded reference records</p>
          </CardContent>
        </Card>
      </div>

      {!hasVisibleSections ? <SettingsEmptyState /> : null}

      {systemSections.length > 0 ? (
        <section className="space-y-4" aria-labelledby="system-settings-heading">
          <div className="space-y-2">
            <h2 id="system-settings-heading" className="text-2xl font-semibold text-brand-espresso">
              Business Settings
            </h2>
            <p className="max-w-3xl text-sm leading-6 text-brand-mocha">
              Core configuration for company identity, payments, receipts, notifications, and
              operational controls.
            </p>
          </div>
          <SettingsGrid
            canManage={(section) => canManageSettings && canManageSection(section)}
            onOpenSection={handleOpenSection}
            sections={systemSections}
          />
        </section>
      ) : null}

      {canViewMasterData && masterDataSections.length > 0 ? (
        <section className="space-y-4" aria-labelledby="master-data-settings-heading">
          <div className="space-y-2">
            <h2
              id="master-data-settings-heading"
              className="text-2xl font-semibold text-brand-espresso"
            >
              Master Data
            </h2>
            <p className="max-w-3xl text-sm leading-6 text-brand-mocha">
              Manage reusable system data used across products, orders, inventory, POS billing, and
              reporting.
            </p>
          </div>
          <SettingsGrid
            canManage={(section) => canManageMasterData && canManageSection(section)}
            onOpenSection={handleOpenSection}
            sections={masterDataSections}
          />
        </section>
      ) : null}
    </div>
  );
}
