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
import { Card, CardContent } from "@/components/ui/card";
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
  const settingsOverview = settingsOverviewQuery.data;
  const masterData = masterDataOverviewQuery.data;
  const summaryCards = [
    {
      detail: `${settingsOverview?.defaultCurrency ?? "Currency"} · ${settingsOverview?.defaultTimezone ?? "Timezone"}`,
      isLoading: settingsOverviewQuery.isLoading,
      label: "Company profile",
      value: settingsOverview?.companyProfileCompleted ? "Complete" : "Pending",
    },
    {
      detail: "Configured locations",
      isLoading: settingsOverviewQuery.isLoading,
      label: "Branches",
      value: String(settingsOverview?.branchCount ?? 0),
    },
    {
      detail: "Active financial records",
      isLoading: settingsOverviewQuery.isLoading,
      label: "Tax & payments",
      value: String(
        (settingsOverview?.activeTaxRatesCount ?? 0) +
          (settingsOverview?.activePaymentMethodsCount ?? 0),
      ),
    },
    {
      detail: "Seeded reference records",
      isLoading: masterDataOverviewQuery.isLoading,
      label: "Master data",
      value: String(
        masterData
          ? masterData.unitsCount +
              masterData.productCategoriesCount +
              masterData.ingredientCategoriesCount +
              masterData.packagingCategoriesCount +
              masterData.orderStatusesCount +
              masterData.paymentStatusesCount
          : 0,
      ),
    },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8">
      <PageHeader
        title="Settings"
        description="Configure your business, financial rules, master data, users, and operational preferences."
      />

      {/* Four across at every width. These are context for the sections below,
          not the point of the page, so they read at cell size rather than
          filling the screen above the thing you came here to open. */}
      <div className="flex min-w-0 gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-4 sm:gap-4 sm:overflow-visible sm:pb-0">
        {summaryCards.map((card) => (
          <Card className="w-36 shrink-0 sm:w-auto sm:min-w-0" key={card.label}>
            <CardContent className="p-4">
              <p className="text-meta text-foreground-muted">{card.label}</p>
              {/* A loading query asserted "Pending" and 0, which are answers,
                  not the absence of one. */}
              <p className="mt-1 text-section font-medium tabular-nums">
                {card.isLoading ? "—" : card.value}
              </p>
              <p className="mt-0.5 break-words text-meta text-foreground-muted">{card.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {!hasVisibleSections ? <SettingsEmptyState /> : null}

      {systemSections.length > 0 ? (
        <section className="grid gap-4" aria-labelledby="system-settings-heading">
          <div className="grid gap-1">
            <h2 className="text-section font-medium" id="system-settings-heading">
              Business Settings
            </h2>
            <p className="max-w-3xl text-cell text-foreground-muted">
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
        <section className="grid gap-4" aria-labelledby="master-data-settings-heading">
          <div className="grid gap-1">
            <h2 className="text-section font-medium" id="master-data-settings-heading">
              Master Data
            </h2>
            <p className="max-w-3xl text-cell text-foreground-muted">
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
