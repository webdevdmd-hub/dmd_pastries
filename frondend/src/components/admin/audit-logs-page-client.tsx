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
import type { ActivityEntityType, ActivityLog } from "@/types/activity-log";

const entityOptions: { label: string; value: ActivityEntityType | "all" }[] = [
  { label: "All entities", value: "all" },
  { label: "Auth", value: "auth" },
  { label: "Business", value: "business" },
  { label: "User", value: "user" },
  { label: "Role", value: "role" },
  { label: "Settings", value: "settings" },
  { label: "Branch", value: "branch" },
  { label: "POS", value: "pos" },
];

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
          className="rounded-3xl border border-brand-cappuccino bg-brand-latte/70 p-4"
          key={item.id}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-brand-espresso">{item.summary}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{item.entityType}</Badge>
              <Badge variant="secondary">{item.eventType}</Badge>
            </div>
          </div>
          <p className="mt-2 text-sm text-brand-mocha">{item.createdAt}</p>
          <p className="mt-1 text-xs text-brand-mocha/80">
            Actor: {item.actorUserId ?? "N/A"} | Target: {item.targetUserId ?? "N/A"}
          </p>
        </article>
      ))}
    </div>
  );
}

export function AuditLogsPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canViewAuditLogs = hasAnyPermission([PERMISSIONS.auditLogsView]);

  const [entityFilter, setEntityFilter] = useState<ActivityEntityType | "all">("all");
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
        description="Connected to global and user-specific activity log endpoints with entity filtering and cursor pagination."
      />

      <Card>
        <CardHeader>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-cappuccino/50 text-brand-mocha">
            <FileClock className="h-6 w-6" />
          </div>
          <CardTitle>Business Activity Stream</CardTitle>
          <CardDescription>
            Endpoint: GET /api/v1/activity-logs?entity_type=user&limit=50&cursor=
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-[220px_1fr]">
            <Select
              value={entityFilter}
              onValueChange={(value) => {
                const nextValue = value as ActivityEntityType | "all";
                setEntityFilter(nextValue);
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
              Showing up to 50 records per page. Use Load More to continue with cursor pagination.
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
            Endpoint: GET /api/v1/users/:id/activity?limit=50&cursor=
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-3 md:flex-row">
            <Input
              placeholder="Enter user ID"
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
              Enter a user ID to fetch activity.
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
