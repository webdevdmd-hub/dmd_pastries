"use client";

import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";

import { auditDayKey, AuditLogEntry } from "@/components/admin/audit-log-entry";
import {
  type AuditLogFilters,
  AuditLogsToolbar,
  defaultAuditLogFilters,
} from "@/components/admin/audit-logs-toolbar";
import { EmptyState, FailedState, FilteredState } from "@/components/shared/collection-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PERMISSIONS } from "@/constants/permissions";
import { useActivityLogs, useUserActivityLogs } from "@/hooks/use-activity-logs";
import { usePermission } from "@/hooks/use-permission";
import { useCompanySettings } from "@/hooks/use-settings-data";
import { useUsers } from "@/hooks/use-users";
import { getErrorMessage } from "@/lib/api/client";
import type { ActivityLog } from "@/types/activity-log";

const entityOptions: { label: string; value: string }[] = [
  { label: "All modules", value: "all" },
  { label: "Authentication", value: "auth" },
  { label: "Business Settings", value: "business" },
  { label: "Administration - Users", value: "user" },
  { label: "Administration - Roles", value: "role" },
  { label: "Settings", value: "settings" },
  { label: "Settings - Tax Rates", value: "tax_rate" },
  { label: "Settings - Payment Methods", value: "payment_method" },
  { label: "Branches", value: "branch" },
  { label: "Products", value: "product" },
  { label: "Inventory", value: "inventory" },
  { label: "Stock Locations", value: "stock_location" },
  { label: "Stock Movements", value: "stock_movement" },
  { label: "Stock Transfers", value: "stock_transfer" },
  { label: "POS", value: "pos" },
  { label: "POS Sales", value: "sale" },
  { label: "POS Refunds", value: "sale_refund" },
  { label: "Bakery Orders", value: "bakery_order" },
  { label: "Bakery Order Payments", value: "bakery_order_payment" },
  { label: "Purchasing", value: "purchasing" },
  { label: "Purchase Orders", value: "purchase_order" },
  { label: "Purchase Bills", value: "purchase_invoice" },
  { label: "Goods Receipts", value: "purchase_receipt" },
  { label: "Vendor Credits", value: "purchase_return" },
  { label: "Supplier Payments", value: "supplier_payment" },
  { label: "Expenses", value: "expenses" },
  { label: "Customers", value: "customer" },
  { label: "Suppliers", value: "supplier" },
  { label: "Manufacturing", value: "manufacturing" },
  { label: "Manufacturing Batches", value: "production_batch" },
  { label: "Recipes", value: "recipe" },
  { label: "Accounting", value: "accounting" },
  { label: "Journal Entries", value: "journal_entry" },
  { label: "Chart Accounts", value: "chart_account" },
  { label: "Payment Accounts", value: "payment_account" },
  { label: "Account Transfers", value: "account_transfer" },
  { label: "Platform Settlements", value: "platform_settlement" },
];

const fallbackAuditTimezone = "Asia/Dubai";

function resolveAuditTimezone(value: string | undefined): string {
  const trimmedTimezone = value?.trim();
  const timezone =
    trimmedTimezone && trimmedTimezone.length > 0 ? trimmedTimezone : fallbackAuditTimezone;

  try {
    new Intl.DateTimeFormat("en-AE", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return fallbackAuditTimezone;
  }
}

function groupByDay(logs: ActivityLog[], timezone: string): { day: string; logs: ActivityLog[] }[] {
  const groups: { day: string; logs: ActivityLog[] }[] = [];

  logs.forEach((log) => {
    const day = auditDayKey(log.createdAt, timezone);
    const current = groups.at(-1);

    if (current?.day === day) {
      current.logs.push(log);
      return;
    }

    groups.push({ day, logs: [log] });
  });

  return groups;
}

/**
 * One activity stream.
 *
 * This page used to be two near-identical cards -- a business stream and a
 * user stream -- each with its own copy of the date controls, its own loading
 * and error states, and its own Load More. The second one only worked if you
 * already had a user's UUID to paste. Who is a filter, not a second page, so
 * there is one list now and one set of controls above it.
 */
export function AuditLogsPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canViewAuditLogs = hasAnyPermission([PERMISSIONS.auditLogsView]);
  const companySettingsQuery = useCompanySettings(canViewAuditLogs);
  const usersQuery = useUsers({ search: "", status: "all" }, canViewAuditLogs);

  const [filters, setFilters] = useState<AuditLogFilters>(defaultAuditLogFilters);
  const [cursor, setCursor] = useState<string | null>(null);
  const [items, setItems] = useState<ActivityLog[]>([]);

  const timezone = useMemo(
    () => resolveAuditTimezone(companySettingsQuery.data?.timezone),
    [companySettingsQuery.data?.timezone],
  );
  const entityType = filters.entityType === "all" ? null : filters.entityType;
  const userId = filters.userId.length > 0 ? filters.userId : null;

  const sharedFilters = useMemo(
    () => ({
      ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
      ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
      cursor,
      limit: 50,
      timezone,
    }),
    [cursor, filters.dateFrom, filters.dateTo, timezone],
  );

  // Filtering by user hits a different endpoint, so exactly one of these runs.
  const businessLogsQuery = useActivityLogs(
    { ...sharedFilters, ...(entityType ? { entityType } : {}) },
    canViewAuditLogs && userId === null,
  );
  const userLogsQuery = useUserActivityLogs(
    userId,
    sharedFilters,
    canViewAuditLogs && userId !== null,
  );
  const activeQuery = userId === null ? businessLogsQuery : userLogsQuery;

  // Any change to what is being asked for restarts the cursor, or page two of
  // the old question gets appended to page one of the new one.
  const filterKey = `${filters.entityType}|${filters.userId}|${filters.dateFrom}|${filters.dateTo}|${timezone}`;
  useEffect(() => {
    setCursor(null);
    setItems([]);
  }, [filterKey]);

  useEffect(() => {
    if (!activeQuery.data) {
      return;
    }

    setItems((current) =>
      cursor === null ? activeQuery.data.items : [...current, ...activeQuery.data.items],
    );
  }, [activeQuery.data, cursor]);

  if (!canViewAuditLogs) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <PageHeader
          description="Every recorded change, who made it, and what it changed."
          title="Audit Logs"
        />
        <EmptyState
          description="You need `audit_logs.view` to read the activity stream."
          title="Access denied"
        />
      </div>
    );
  }

  const hasActiveFilters =
    filters.entityType !== "all" ||
    filters.userId.length > 0 ||
    filters.dateFrom.length > 0 ||
    filters.dateTo.length > 0;
  const isFirstLoad = activeQuery.isLoading && cursor === null;
  const groups = groupByDay(items, timezone);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        description="Every recorded change, who made it, and what it changed."
        title="Audit Logs"
      />

      <AuditLogsToolbar
        entityOptions={entityOptions}
        filters={filters}
        isUsersLoading={usersQuery.isLoading}
        onFiltersChange={setFilters}
        timezone={timezone}
        users={usersQuery.data ?? []}
      />

      {isFirstLoad ? (
        <div className="grid gap-2">
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      ) : null}

      {!isFirstLoad && activeQuery.error ? (
        <FailedState
          detail={getErrorMessage(activeQuery.error)}
          noun="activity logs"
          onRetry={() => {
            void activeQuery.refetch();
          }}
        />
      ) : null}

      {/* An empty log and a filter that matched nothing need opposite
          remedies, and "nothing has ever happened" is rarely the true one. */}
      {!isFirstLoad && !activeQuery.error && items.length === 0 && hasActiveFilters ? (
        <FilteredState noun="activity" onClearFilters={() => setFilters(defaultAuditLogFilters)} />
      ) : null}

      {!isFirstLoad && !activeQuery.error && items.length === 0 && !hasActiveFilters ? (
        <EmptyState
          description="Business activity appears here as soon as someone changes a record."
          title="No activity recorded yet"
        />
      ) : null}

      {/* Grouped by day, because the first question asked of a log is always
          "what happened on the day it went wrong". */}
      {groups.map((group) => (
        <section className="grid gap-2" key={group.day}>
          <h2 className="text-meta font-medium text-foreground-muted">{group.day}</h2>
          <Card className="overflow-hidden">
            <ul className="grid gap-px bg-border">
              {group.logs.map((log) => (
                <AuditLogEntry key={log.id} log={log} timezone={timezone} />
              ))}
            </ul>
          </Card>
        </section>
      ))}

      {items.length > 0 && activeQuery.data?.nextCursor ? (
        <div className="flex justify-center">
          <Button
            disabled={activeQuery.isFetching}
            onClick={() => {
              const next = activeQuery.data.nextCursor;
              if (next) {
                setCursor(next);
              }
            }}
            type="button"
            variant="outline"
          >
            {activeQuery.isFetching ? "Loading..." : "Load older activity"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
