"use client";

import { FileClock, ShieldAlert } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERMISSIONS } from "@/constants/permissions";
import { useActivityLogs, useUserActivityLogs } from "@/hooks/use-activity-logs";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api/client";
import type { ActivityLog, ActivityMetadataValue } from "@/types/activity-log";

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
  { label: "Stock Movements", value: "stock_movements" },
  { label: "POS", value: "pos" },
  { label: "Bakery Orders", value: "bakery_order" },
  { label: "Purchasing", value: "purchasing" },
  { label: "Expenses", value: "expenses" },
  { label: "Customers", value: "customer" },
  { label: "Suppliers", value: "supplier" },
  { label: "Manufacturing", value: "manufacturing" },
  { label: "Recipes", value: "recipe" },
  { label: "Accounting", value: "accounting" },
];

function formatAuditDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat("en-AE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function labelFromKey(value: string): string {
  return value
    .replaceAll("_", " ")
    .replaceAll(".", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMetadataValue(value: ActivityMetadataValue): string {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "Empty")).join(", ");
  }

  if (typeof value === "object" && value !== null) {
    return Object.entries(value)
      .map(([key, item]) => `${labelFromKey(key)}: ${String(item ?? "Empty")}`)
      .join("; ");
  }

  return String(value ?? "Empty");
}

function visibleMetadataEntries(metadata: ActivityLog["metadata"]): [string, ActivityMetadataValue][] {
  const hiddenKeys = new Set([
    "record_label",
    "record_name",
    "name",
    "full_name",
    "email",
    "branch_name",
    "role_name",
    "product_name",
    "variant_name",
    "tax_rate_name",
    "tax_name",
    "payment_method_name",
    "method_name",
    "sale_number",
    "order_number",
    "expense_number",
    "transfer_number",
    "reference_number",
    "supplier_name",
    "customer_name",
    "recipe_name",
    "batch_number",
    "production_batch_number",
    "invoice_number",
    "receipt_number",
    "return_number",
  ]);

  return Object.entries(metadata).filter(([key]) => !hiddenKeys.has(key));
}

function actorLabel(item: ActivityLog): string {
  if (item.actorUserName && item.actorUserEmail) {
    return `${item.actorUserName} (${item.actorUserEmail})`;
  }
  return item.actorUserName || item.actorUserEmail || "System";
}

function targetLabel(item: ActivityLog): string {
  if (!item.targetUserId && !item.targetUserName && !item.targetUserEmail) {
    return "";
  }
  if (item.targetUserName && item.targetUserEmail) {
    return `${item.targetUserName} (${item.targetUserEmail})`;
  }
  return item.targetUserName || item.targetUserEmail || "Unknown user";
}

function LogsList({
  emptyMessage,
  items,
}: {
  emptyMessage: string;
  items: ActivityLog[];
}): JSX.Element {
  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-brand-cappuccino bg-brand-latte/70 p-4 text-sm font-medium text-brand-mocha">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <article
          className="rounded-3xl border border-brand-cappuccino bg-white/80 p-4 shadow-sm"
          key={item.id}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h2 className="text-base font-semibold text-brand-espresso">{item.actionLabel}</h2>
              <p className="text-sm text-brand-mocha">
                <span className="font-medium text-brand-espresso">{actorLabel(item)}</span>
                {" performed this action"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{item.moduleLabel}</Badge>
              <Badge variant="outline">{formatAuditDate(item.createdAt)}</Badge>
            </div>
          </div>
          <div className="mt-4 grid gap-3 text-sm text-brand-mocha md:grid-cols-2">
            <div className="rounded-2xl border border-brand-cappuccino/70 bg-brand-latte/50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-mocha/70">
                Record
              </p>
              <p className="mt-1 font-medium text-brand-espresso">
                {item.recordLabel || "Unknown record"}
              </p>
            </div>
            <div className="rounded-2xl border border-brand-cappuccino/70 bg-brand-latte/50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-mocha/70">
                Module
              </p>
              <p className="mt-1 font-medium text-brand-espresso">{item.moduleLabel}</p>
            </div>
          </div>
          {targetLabel(item) ? (
            <p className="mt-3 text-sm text-brand-mocha">
              Target user: <span className="font-medium text-brand-espresso">{targetLabel(item)}</span>
            </p>
          ) : null}
          {item.summary && item.summary !== item.actionLabel && item.summary !== item.recordLabel ? (
            <p className="mt-3 text-sm text-brand-mocha">{item.summary}</p>
          ) : null}
          {visibleMetadataEntries(item.metadata).length > 0 ? (
            <div className="mt-3 rounded-2xl border border-brand-cappuccino/70 bg-brand-latte/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-mocha/70">
                Details
              </p>
              <dl className="mt-2 grid gap-2 text-xs text-brand-mocha md:grid-cols-2">
                {visibleMetadataEntries(item.metadata).map(([key, value]) => (
                  <div key={key}>
                    <dt className="font-semibold text-brand-espresso">{labelFromKey(key)}</dt>
                    <dd className="break-words">{formatMetadataValue(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
          <p className="mt-3 text-xs text-brand-mocha/70">
            Technical reference: {item.eventType} / {item.entityType}
          </p>
        </article>
      ))}
    </div>
  );
}

export function AuditLogsPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canViewAuditLogs = hasAnyPermission([PERMISSIONS.auditLogsView]);

  const [entityFilter, setEntityFilter] = useState("all");
  const [globalCursor, setGlobalCursor] = useState<string | null>(null);
  const [globalItems, setGlobalItems] = useState<ActivityLog[]>([]);

  const [userIdInput, setUserIdInput] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userCursor, setUserCursor] = useState<string | null>(null);
  const [userItems, setUserItems] = useState<ActivityLog[]>([]);

  const globalLogsQuery = useActivityLogs(
    {
      ...(entityFilter !== "all" ? { entityType: entityFilter } : {}),
      limit: 50,
      cursor: globalCursor,
    },
    canViewAuditLogs,
  );

  const userLogsQuery = useUserActivityLogs(
    selectedUserId,
    {
      limit: 50,
      cursor: userCursor,
    },
    canViewAuditLogs && selectedUserId !== null,
  );

  useEffect(() => {
    if (!globalLogsQuery.data) {
      return;
    }

    setGlobalItems((current) =>
      globalCursor === null
        ? globalLogsQuery.data.items
        : [...current, ...globalLogsQuery.data.items],
    );
  }, [globalCursor, globalLogsQuery.data]);

  useEffect(() => {
    if (!userLogsQuery.data) {
      return;
    }

    setUserItems((current) =>
      userCursor === null ? userLogsQuery.data.items : [...current, ...userLogsQuery.data.items],
    );
  }, [userCursor, userLogsQuery.data]);

  if (!canViewAuditLogs) {
    return (
      <div className="mx-auto max-w-3xl">
        <Alert className="border-brand-cappuccino bg-white/80">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Audit logs require admin access</AlertTitle>
          <AlertDescription>
            You need audit log view access to review activity history.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="Admin Audit Logs"
        description="Review who changed business data, which module was affected, and which record was updated."
      />

      <Card>
        <CardHeader>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-cappuccino/50 text-brand-mocha">
            <FileClock className="h-6 w-6" />
          </div>
          <CardTitle>Business Activity Stream</CardTitle>
          <CardDescription>
            Filter business activity by module and load older entries with cursor pagination.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-[220px_1fr]">
            <Select
              value={entityFilter}
              onValueChange={(value) => {
                setEntityFilter(value);
                setGlobalCursor(null);
                setGlobalItems([]);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by entity" />
              </SelectTrigger>
              <SelectContent>
                {entityOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="rounded-2xl border border-brand-cappuccino bg-brand-latte/70 px-4 py-3 text-sm text-brand-mocha">
              Showing up to 50 records per page. Each entry resolves users, modules, actions, and
              record references into business-readable labels where available.
            </div>
          </div>

          {globalLogsQuery.isLoading && globalCursor === null ? (
            <div className="rounded-3xl border border-brand-cappuccino bg-brand-latte/70 p-4 text-sm font-medium text-brand-mocha">
              Loading activity logs...
            </div>
          ) : null}

          {globalLogsQuery.error ? (
            <Alert className="border-brand-cappuccino bg-brand-latte/70">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Failed to load activity logs</AlertTitle>
              <AlertDescription>{getErrorMessage(globalLogsQuery.error)}</AlertDescription>
            </Alert>
          ) : null}

          <LogsList emptyMessage="No activity logs found for this filter." items={globalItems} />

          <div className="flex items-center justify-end">
            <Button
              disabled={!globalLogsQuery.data?.nextCursor || globalLogsQuery.isFetching}
              onClick={() => {
                if (globalLogsQuery.data?.nextCursor) {
                  setGlobalCursor(globalLogsQuery.data.nextCursor);
                }
              }}
              variant="outline"
            >
              {globalLogsQuery.isFetching ? "Loading..." : "Load More"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>User Activity Stream</CardTitle>
          <CardDescription>
            Review activity created by or targeting one user account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-3 md:flex-row">
            <Input
              placeholder="Paste user ID"
              value={userIdInput}
              onChange={(event) => {
                setUserIdInput(event.target.value);
              }}
            />
            <Button
              onClick={() => {
                const nextUserId = userIdInput.trim();
                if (!nextUserId) {
                  return;
                }

                setSelectedUserId(nextUserId);
                setUserCursor(null);
                setUserItems([]);
              }}
              variant="secondary"
            >
              Load User Activity
            </Button>
          </div>

          {!selectedUserId ? (
            <div className="rounded-3xl border border-brand-cappuccino bg-brand-latte/70 p-4 text-sm font-medium text-brand-mocha">
              Paste a user ID to fetch that user&apos;s activity history.
            </div>
          ) : null}

          {userLogsQuery.isLoading && userCursor === null ? (
            <div className="rounded-3xl border border-brand-cappuccino bg-brand-latte/70 p-4 text-sm font-medium text-brand-mocha">
              Loading user activity...
            </div>
          ) : null}

          {userLogsQuery.error ? (
            <Alert className="border-brand-cappuccino bg-brand-latte/70">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Failed to load user activity</AlertTitle>
              <AlertDescription>{getErrorMessage(userLogsQuery.error)}</AlertDescription>
            </Alert>
          ) : null}

          {selectedUserId ? (
            <LogsList emptyMessage="No activity logs found for this user." items={userItems} />
          ) : null}

          <div className="flex items-center justify-end">
            <Button
              disabled={!userLogsQuery.data?.nextCursor || userLogsQuery.isFetching}
              onClick={() => {
                if (userLogsQuery.data?.nextCursor) {
                  setUserCursor(userLogsQuery.data.nextCursor);
                }
              }}
              variant="outline"
            >
              {userLogsQuery.isFetching ? "Loading..." : "Load More"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
