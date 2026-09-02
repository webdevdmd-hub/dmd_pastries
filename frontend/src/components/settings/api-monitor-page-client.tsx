"use client";

import {
  Activity,
  Clock3,
  LoaderCircle,
  PlayCircle,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import type { JSX } from "react";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/settings/access-denied-card";
import { EmptyState, FilteredState } from "@/components/shared/collection-state";
import { CollectionStateRow } from "@/components/shared/collection-state-row";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PERMISSIONS } from "@/constants/permissions";
import {
  clearApiMonitorHistory,
  useApiMonitorEvents,
  useApiRouteCatalog,
} from "@/hooks/use-api-monitor";
import { useAuth } from "@/hooks/use-auth";
import { usePermission } from "@/hooks/use-permission";
import { runApiSafeProbe } from "@/lib/api/api-monitor";
import { getErrorMessage } from "@/lib/api/client";
import type { ApiMonitorEvent, ApiMonitorStatus, ApiRouteCatalogItem } from "@/types/api-monitor";

type RouteStatusRow = ApiRouteCatalogItem & {
  latestEvent: ApiMonitorEvent | null;
  status: ApiMonitorStatus;
};

type StatusFilter = ApiMonitorStatus | "all";
type ModuleRouteGroup = [string, RouteStatusRow[]];

const statusLabels: Record<ApiMonitorStatus, string> = {
  expected_validation: "Expected Validation",
  failed: "Failed",
  healthy: "Healthy",
  not_tested: "Not Tested",
  server_error: "Server Error",
  slow: "Slow",
  unauthorized: "Unauthorized",
};

const statusClasses: Record<ApiMonitorStatus, string> = {
  expected_validation: "border-info/30 bg-info-tint text-info-text",
  failed: "border-danger/30 bg-danger-tint text-danger-text",
  healthy: "border-money/30 bg-money-tint text-money-text",
  not_tested: "border-brand-cappuccino bg-brand-latte text-brand-mocha",
  server_error: "border-danger/30 bg-danger-tint text-danger-text",
  slow: "border-warning/30 bg-warning-tint text-warning-text",
  unauthorized: "border-warning/30 bg-warning-tint text-warning-text",
};

function routeKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}

function formatResponseTime(value: number | null): string {
  if (value === null) {
    return "-";
  }

  return `${String(value)} ms`;
}

function formatCheckedAt(value: string | null): string {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function ApiStatusBadge({ status }: { status: ApiMonitorStatus }): JSX.Element {
  return <Badge className={statusClasses[status]}>{statusLabels[status]}</Badge>;
}

function buildRows(routes: ApiRouteCatalogItem[], events: ApiMonitorEvent[]): RouteStatusRow[] {
  const latestByRoute = new Map<string, ApiMonitorEvent>();

  events.forEach((event) => {
    const path = event.routePath ?? event.endpoint;
    const key = routeKey(event.method, path);

    if (!latestByRoute.has(key)) {
      latestByRoute.set(key, event);
    }
  });

  return routes.map((route) => {
    const latestEvent = latestByRoute.get(routeKey(route.method, route.path)) ?? null;

    return {
      ...route,
      latestEvent,
      status: latestEvent?.status ?? "not_tested",
    };
  });
}

function filterRows({
  methodFilter,
  moduleFilter,
  rows,
  search,
  statusFilter,
}: {
  methodFilter: string;
  moduleFilter: string;
  rows: RouteStatusRow[];
  search: string;
  statusFilter: StatusFilter;
}): RouteStatusRow[] {
  const normalizedSearch = search.trim().toLowerCase();

  return rows.filter((row) => {
    const matchesSearch =
      normalizedSearch.length === 0 ||
      row.apiName.toLowerCase().includes(normalizedSearch) ||
      row.path.toLowerCase().includes(normalizedSearch) ||
      row.method.toLowerCase().includes(normalizedSearch) ||
      row.module.toLowerCase().includes(normalizedSearch);
    const matchesModule = moduleFilter === "all" || row.module === moduleFilter;
    const matchesMethod = methodFilter === "all" || row.method === methodFilter;
    const matchesStatus = statusFilter === "all" || row.status === statusFilter;

    return matchesSearch && matchesModule && matchesMethod && matchesStatus;
  });
}

function groupRows(rows: RouteStatusRow[]): ModuleRouteGroup[] {
  const grouped = new Map<string, RouteStatusRow[]>();

  rows.forEach((row) => {
    grouped.set(row.module, [...(grouped.get(row.module) ?? []), row]);
  });

  return Array.from(grouped.entries()).sort(([left], [right]) => left.localeCompare(right));
}

function methodBadgeClass(method: string): string {
  switch (method) {
    case "DELETE":
      return "border-danger/30 bg-danger-tint text-danger-text";
    case "PATCH":
    case "PUT":
      return "border-info/30 bg-info-tint text-info-text";
    case "POST":
      return "border-warning/30 bg-warning-tint text-warning-text";
    default:
      return "border-money/30 bg-money-tint text-money-text";
  }
}

function RouteTable({
  groups,
  isFiltered,
  onClearFilters,
  query,
  totalCount,
}: {
  groups: ModuleRouteGroup[];
  isFiltered: boolean;
  onClearFilters: () => void;
  query: string;
  totalCount: number;
}): JSX.Element {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-52">API</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="min-w-80">Endpoint</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Checked</TableHead>
                <TableHead className="min-w-72">Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* This said "No APIs match the current filters" unconditionally,
                  including with no filter set — the inverse of the usual bug. */}
              {groups.length === 0 ? (
                <CollectionStateRow colSpan={8}>
                  {isFiltered ? (
                    <FilteredState
                      noun="APIs"
                      onClearFilters={onClearFilters}
                      query={query}
                      totalCount={totalCount}
                    />
                  ) : (
                    <EmptyState
                      description="The route registry is empty, so there is nothing to probe."
                      icon={Activity}
                      title="No APIs registered"
                    />
                  )}
                </CollectionStateRow>
              ) : null}

              {groups.map(([module, rows]) => (
                <Fragment key={module}>
                  <TableRow key={`${module}-heading`} className="bg-brand-cappuccino/20">
                    <TableCell colSpan={8} className="font-semibold text-brand-espresso">
                      {module} APIs
                    </TableCell>
                  </TableRow>
                  {rows.map((row) => (
                    <TableRow key={routeKey(row.method, row.path)}>
                      <TableCell className="font-medium text-brand-espresso">
                        {row.apiName}
                      </TableCell>
                      <TableCell>
                        <Badge className={methodBadgeClass(row.method)}>{row.method}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-brand-mocha">
                        {row.path}
                      </TableCell>
                      <TableCell>
                        <ApiStatusBadge status={row.status} />
                      </TableCell>
                      <TableCell>{row.latestEvent?.statusCode ?? "-"}</TableCell>
                      <TableCell>
                        {formatResponseTime(row.latestEvent?.responseTimeMs ?? null)}
                      </TableCell>
                      <TableCell>{formatCheckedAt(row.latestEvent?.checkedAt ?? null)}</TableCell>
                      <TableCell className="max-w-sm truncate text-sm text-brand-mocha">
                        {row.latestEvent?.errorMessage ?? "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentEventsPanel({ events }: { events: ApiMonitorEvent[] }): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-brand-espresso">
          <Activity className="h-4 w-4" />
          Live Calls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {events.length === 0 ? (
          <EmptyState
            description="Calls appear here as you use the app. Reloading the page clears them."
            icon={Activity}
            title="No calls captured yet"
          />
        ) : null}

        {events.slice(0, 15).map((event) => (
          <div className="rounded-xl border border-brand-cappuccino bg-card p-3" key={event.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-brand-espresso">{event.apiName}</p>
                <p className="mt-1 font-mono text-xs text-brand-mocha">
                  {event.method} {event.endpoint}
                </p>
              </div>
              <ApiStatusBadge status={event.status} />
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-brand-mocha">
              <span>{event.module}</span>
              <span>{event.statusCode || "No code"}</span>
              <span>{event.responseTimeMs} ms</span>
              <span>{formatCheckedAt(event.checkedAt)}</span>
              <span>{event.source === "safe_probe" ? "Safe check" : "Live action"}</span>
            </div>
            {event.errorMessage ? (
              <p className="mt-2 line-clamp-2 text-xs text-danger-text">{event.errorMessage}</p>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SummaryCards({
  events,
  rows,
}: {
  events: ApiMonitorEvent[];
  rows: RouteStatusRow[];
}): JSX.Element {
  const failedCount = rows.filter(
    (row) =>
      row.status === "failed" || row.status === "server_error" || row.status === "unauthorized",
  ).length;
  const slowCount = rows.filter((row) => row.status === "slow").length;
  const checkedCount = rows.filter((row) => row.status !== "not_tested").length;

  const cards = [
    { detail: "Registered backend routes", label: "All APIs", value: String(rows.length) },
    { detail: "Routes with a result", label: "Checked", value: String(checkedCount) },
    {
      detail: "Captured in this browser session",
      label: "Live Calls",
      value: String(events.length),
    },
    {
      detail: `${String(slowCount)} slow responses`,
      label: "Needs Attention",
      value: String(failedCount),
    },
  ] as const;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="p-5">
            <p className="text-xs text-brand-mocha">{card.label}</p>
            <p className="mt-3 text-kpi tabular-nums text-foreground">{card.value}</p>
            <p className="mt-1 text-sm text-brand-mocha">{card.detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ApiMonitorPageClient(): JSX.Element {
  const { status } = useAuth();
  const { hasPermission } = usePermission();
  const canViewSettings = hasPermission(PERMISSIONS.settingsView);
  const catalogQuery = useApiRouteCatalog(canViewSettings);
  const events = useApiMonitorEvents();
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isChecking, setIsChecking] = useState(false);
  const [checkedCount, setCheckedCount] = useState(0);

  const routes = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data]);
  const rows = useMemo(() => buildRows(routes, events), [events, routes]);
  const modules = useMemo(
    () => Array.from(new Set(routes.map((route) => route.module))).sort(),
    [routes],
  );
  const methods = useMemo(
    () => Array.from(new Set(routes.map((route) => route.method))).sort(),
    [routes],
  );
  const filteredRows = useMemo(
    () => filterRows({ methodFilter, moduleFilter, rows, search, statusFilter }),
    [methodFilter, moduleFilter, rows, search, statusFilter],
  );
  const groupedRows = useMemo(() => groupRows(filteredRows), [filteredRows]);
  const isRouteTableFiltered =
    search.trim().length > 0 ||
    moduleFilter !== "all" ||
    methodFilter !== "all" ||
    statusFilter !== "all";
  const safeProbeRoutes = useMemo(
    () => routes.filter((route) => route.probeMode === "safe_probe"),
    [routes],
  );

  const handleRunSafeChecks = async (): Promise<void> => {
    if (safeProbeRoutes.length === 0 || isChecking) {
      return;
    }

    setIsChecking(true);
    setCheckedCount(0);

    let nextIndex = 0;
    const workerCount = Math.min(4, safeProbeRoutes.length);

    const runWorker = async (): Promise<void> => {
      while (nextIndex < safeProbeRoutes.length) {
        const route = safeProbeRoutes[nextIndex];
        nextIndex += 1;

        if (!route) {
          continue;
        }

        await runApiSafeProbe(route);
        setCheckedCount((current) => current + 1);
      }
    };

    try {
      await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
      toast.success(`Safe checks completed for ${String(safeProbeRoutes.length)} APIs.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsChecking(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-7xl">
        <LoadingState />
      </div>
    );
  }

  if (!canViewSettings) {
    return <AccessDeniedCard />;
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="API Monitor"
        description="Track backend route health and live API calls triggered by frontend workflows."
        actions={
          <>
            <Button
              disabled={isChecking || safeProbeRoutes.length === 0}
              onClick={() => void handleRunSafeChecks()}
              type="button"
            >
              {isChecking ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="h-4 w-4" />
              )}
              {isChecking
                ? `${String(checkedCount)}/${String(safeProbeRoutes.length)}`
                : "Run Safe Checks"}
            </Button>
            <Button onClick={clearApiMonitorHistory} type="button" variant="outline">
              <Trash2 className="h-4 w-4" />
              Clear History
            </Button>
          </>
        }
      />

      {catalogQuery.isError ? (
        <Alert className="border-danger/30 bg-danger-tint text-danger-text">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Unable to load API catalog</AlertTitle>
          <AlertDescription>{getErrorMessage(catalogQuery.error)}</AlertDescription>
        </Alert>
      ) : null}

      <SummaryCards events={events} rows={rows} />

      <Card>
        <CardContent className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-brand-mocha" />
            <Input
              className="pl-9"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search API name, endpoint, module, method"
              value={search}
            />
          </div>
          <Select onValueChange={setModuleFilter} value={moduleFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Module" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Modules</SelectItem>
              {modules.map((module) => (
                <SelectItem key={module} value={module}>
                  {module}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select onValueChange={setMethodFilter} value={methodFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Methods</SelectItem>
              {methods.map((method) => (
                <SelectItem key={method} value={method}>
                  {method}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
            value={statusFilter}
          >
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {(Object.keys(statusLabels) as ApiMonitorStatus[]).map((apiStatus) => (
                <SelectItem key={apiStatus} value={apiStatus}>
                  {statusLabels[apiStatus]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {catalogQuery.isLoading ? <LoadingState /> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <RouteTable
          groups={groupedRows}
          isFiltered={isRouteTableFiltered}
          onClearFilters={() => {
            setSearch("");
            setModuleFilter("all");
            setMethodFilter("all");
            setStatusFilter("all");
          }}
          query={search}
          totalCount={rows.length}
        />
        <div className="space-y-4">
          <Card>
            <CardContent className="flex items-start gap-3 p-5">
              <Clock3 className="mt-1 h-4 w-4 text-brand-caramel" />
              <div>
                <p className="font-semibold text-brand-espresso">Session-only history</p>
                <p className="mt-1 text-sm leading-6 text-brand-mocha">
                  Live call results stay in this browser session and are cleared on refresh or by
                  using Clear History.
                </p>
              </div>
            </CardContent>
          </Card>
          <RecentEventsPanel events={events} />
        </div>
      </div>
    </div>
  );
}
