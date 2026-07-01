"use client";

import { Database, RefreshCw, Save, Search } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";

import { LoadingState } from "@/components/shared/loading-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import {
  useSuperAdminTableRows,
  useSuperAdminTables,
  useUpdateSuperAdminTableRow,
} from "@/hooks/use-super-admin";
import { getErrorMessage } from "@/lib/api/client";
import type { SuperAdminTableColumn, SuperAdminTableRow } from "@/types/super-admin";

const pageSize = 25;

function cellText(value: SuperAdminTableRow[string] | undefined): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return String(value);
}

function normalizeEditableValue(
  column: SuperAdminTableColumn,
  value: string,
): string | number | boolean | null {
  if (column.type === "int") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }
  if (column.type === "boolean") {
    return value === "true";
  }
  return value;
}

function rowKey(row: SuperAdminTableRow, index: number): string {
  const id = row.id;
  return typeof id === "string" && id.length > 0 ? id : ["row", String(index)].join("-");
}

export function SuperAdminTableExplorerPageClient(): JSX.Element {
  const tablesQuery = useSuperAdminTables();
  const [tableKey, setTableKey] = useState("");
  const [search, setSearch] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [page, setPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState<SuperAdminTableRow | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (tableKey || !tablesQuery.data || tablesQuery.data.length === 0) {
      return;
    }
    const firstTable = tablesQuery.data[0];
    if (firstTable) {
      setTableKey(firstTable.key);
    }
  }, [tableKey, tablesQuery.data]);

  const rowsQuery = useSuperAdminTableRows({
    table: tableKey,
    businessId,
    search,
    page,
    limit: pageSize,
  });
  const updateMutation = useUpdateSuperAdminTableRow(tableKey);

  const columns = useMemo(() => rowsQuery.data?.table.columns ?? [], [rowsQuery.data]);
  const editableColumns = useMemo(() => columns.filter((column) => column.editable), [columns]);
  const selectedRowId = typeof selectedRow?.id === "string" ? selectedRow.id : "";
  const changedValues = useMemo(() => {
    if (!selectedRow) {
      return {};
    }

    return editableColumns.reduce<Record<string, string | number | boolean | null>>(
      (values, column) => {
        const nextValue = editValues[column.key] ?? "";
        const previousValue = selectedRow[column.key];
        if (cellText(previousValue) === nextValue) {
          return values;
        }
        values[column.key] = normalizeEditableValue(column, nextValue);
        return values;
      },
      {},
    );
  }, [editValues, editableColumns, selectedRow]);
  const hasChanges = Object.keys(changedValues).length > 0;
  const canSubmit =
    selectedRowId.length > 0 &&
    hasChanges &&
    reason.trim().length >= 10 &&
    !updateMutation.isPending;

  function resetRowSelection(): void {
    setSelectedRow(null);
    setEditValues({});
    setReason("");
  }

  function handleTableChange(value: string): void {
    setTableKey(value);
    setPage(1);
    resetRowSelection();
  }

  function handleSelectRow(row: SuperAdminTableRow): void {
    const values = editableColumns.reduce<Record<string, string>>((nextValues, column) => {
      nextValues[column.key] = cellText(row[column.key]);
      return nextValues;
    }, {});
    setSelectedRow(row);
    setEditValues(values);
    setReason("");
  }

  async function handleSubmit(): Promise<void> {
    if (!canSubmit) {
      return;
    }
    await updateMutation.mutateAsync({
      rowId: selectedRowId,
      body: {
        reason: reason.trim(),
        values: changedValues,
      },
    });
    resetRowSelection();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
            Controlled Data Surface
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-brand-espresso">Table Explorer</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
            Browse allowlisted operational tables and update only backend-approved fields with an
            audit reason.
          </p>
        </div>
        <Button
          onClick={() => {
            void rowsQuery.refetch();
          }}
          type="button"
          variant="outline"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Alert>
        <Database className="h-4 w-4" />
        <AlertTitle>Allowlist enforced</AlertTitle>
        <AlertDescription>
          This explorer has no SQL editor, no create action, and no delete action. Update attempts
          go through backend field allowlists and platform audit logging.
        </AlertDescription>
      </Alert>

      <div className="grid gap-3 lg:grid-cols-[260px_1fr_280px]">
        <div>
          <Label htmlFor="super-admin-table">Table</Label>
          <Select onValueChange={handleTableChange} value={tableKey}>
            <SelectTrigger id="super-admin-table" className="mt-2">
              <SelectValue placeholder="Choose table" />
            </SelectTrigger>
            <SelectContent>
              {(tablesQuery.data ?? []).map((table) => (
                <SelectItem key={table.key} value={table.key}>
                  {table.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="super-admin-table-search">Search</Label>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
            <Input
              id="super-admin-table-search"
              className="pl-9"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
                resetRowSelection();
              }}
              placeholder="Search allowlisted columns"
              value={search}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="super-admin-business-filter">Business ID</Label>
          <Input
            id="super-admin-business-filter"
            className="mt-2"
            onChange={(event) => {
              setBusinessId(event.target.value);
              setPage(1);
              resetRowSelection();
            }}
            placeholder="Optional tenant filter"
            value={businessId}
          />
        </div>
      </div>

      {tablesQuery.isLoading || rowsQuery.isLoading ? <LoadingState /> : null}

      {tablesQuery.error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load tables</AlertTitle>
          <AlertDescription>{getErrorMessage(tablesQuery.error)}</AlertDescription>
        </Alert>
      ) : null}

      {rowsQuery.error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load table rows</AlertTitle>
          <AlertDescription>{getErrorMessage(rowsQuery.error)}</AlertDescription>
        </Alert>
      ) : null}

      {updateMutation.error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to update row</AlertTitle>
          <AlertDescription>{getErrorMessage(updateMutation.error)}</AlertDescription>
        </Alert>
      ) : null}

      {rowsQuery.data ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="border-stone-300 shadow-none">
            <CardContent className="space-y-4 p-0">
              <div className="flex flex-col gap-2 border-b border-stone-200 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-brand-espresso">
                      {rowsQuery.data.table.label}
                    </h3>
                    <Badge variant={rowsQuery.data.table.canUpdate ? "secondary" : "outline"}>
                      {rowsQuery.data.table.canUpdate ? "Editable fields" : "Read only"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-stone-600">{rowsQuery.data.table.description}</p>
                </div>
                <p className="text-sm text-stone-500">
                  {rowsQuery.data.totalRows} rows · page {rowsQuery.data.page} of{" "}
                  {Math.max(rowsQuery.data.totalPages, 1)}
                </p>
              </div>

              <div className="overflow-x-auto">
                <Table className="min-w-[1000px]">
                  <TableHeader>
                    <TableRow>
                      {columns.map((column) => (
                        <TableHead key={column.key}>
                          <div className="flex items-center gap-2">
                            <span>{column.label}</span>
                            {column.editable ? <Badge variant="outline">edit</Badge> : null}
                            {column.masked ? <Badge variant="outline">masked</Badge> : null}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rowsQuery.data.rows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          className="h-24 text-center text-sm text-stone-500"
                          colSpan={columns.length}
                        >
                          No rows found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rowsQuery.data.rows.map((row, index) => (
                        <TableRow
                          key={rowKey(row, index)}
                          className="cursor-pointer"
                          data-state={rowKey(row, index) === selectedRowId ? "selected" : undefined}
                          onClick={() => handleSelectRow(row)}
                        >
                          {columns.map((column) => (
                            <TableCell key={column.key} className="max-w-[260px] truncate">
                              <span
                                className={row[column.key] === null ? "text-stone-400" : undefined}
                              >
                                {cellText(row[column.key])}
                              </span>
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between border-t border-stone-200 p-4">
                <Button
                  disabled={page <= 1 || rowsQuery.isFetching}
                  onClick={() => {
                    setPage((currentPage) => Math.max(currentPage - 1, 1));
                    resetRowSelection();
                  }}
                  type="button"
                  variant="outline"
                >
                  Previous
                </Button>
                <span className="text-sm text-stone-500">
                  {rowsQuery.isFetching
                    ? "Refreshing..."
                    : [String(rowsQuery.data.rows.length), "visible"].join(" ")}
                </span>
                <Button
                  disabled={
                    rowsQuery.isFetching ||
                    rowsQuery.data.totalPages === 0 ||
                    page >= rowsQuery.data.totalPages
                  }
                  onClick={() => {
                    setPage((currentPage) => currentPage + 1);
                    resetRowSelection();
                  }}
                  type="button"
                  variant="outline"
                >
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-stone-300 shadow-none">
            <CardContent className="space-y-4 p-5">
              <div>
                <h3 className="text-base font-semibold text-brand-espresso">Selected Row</h3>
                <p className="mt-1 text-sm text-stone-600">
                  Choose a row, edit approved fields, then save with a reason.
                </p>
              </div>

              {!selectedRow ? (
                <Alert>
                  <AlertTitle>No row selected</AlertTitle>
                  <AlertDescription>
                    Select a row in the table to inspect available update fields.
                  </AlertDescription>
                </Alert>
              ) : null}

              {selectedRow && editableColumns.length === 0 ? (
                <Alert>
                  <AlertTitle>Read only table</AlertTitle>
                  <AlertDescription>
                    This table is available for inspection only. Use the dedicated Super Admin user
                    or business action screens for controlled changes.
                  </AlertDescription>
                </Alert>
              ) : null}

              {selectedRow && editableColumns.length > 0 ? (
                <>
                  <div className="rounded-md border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">
                    Row ID: <span className="font-mono text-brand-espresso">{selectedRowId}</span>
                  </div>

                  <div className="space-y-3">
                    {editableColumns.map((column) => (
                      <div key={column.key}>
                        <Label htmlFor={`table-field-${column.key}`}>
                          {column.label}
                          <span className="ml-2 text-xs font-normal text-stone-500">
                            {column.type}
                          </span>
                        </Label>
                        <Input
                          id={`table-field-${column.key}`}
                          className="mt-2"
                          inputMode={column.type === "int" ? "numeric" : undefined}
                          onChange={(event) =>
                            setEditValues((currentValues) => ({
                              ...currentValues,
                              [column.key]: event.target.value,
                            }))
                          }
                          value={editValues[column.key] ?? ""}
                        />
                      </div>
                    ))}
                  </div>

                  <div>
                    <Label htmlFor="table-update-reason">Reason</Label>
                    <Textarea
                      id="table-update-reason"
                      className="mt-2 min-h-24"
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Required. Explain why this row needs the update."
                      value={reason}
                    />
                    <p className="mt-1 text-xs text-stone-500">Minimum 10 characters.</p>
                  </div>

                  <Button
                    className="w-full"
                    disabled={!canSubmit}
                    onClick={() => {
                      void handleSubmit();
                    }}
                    type="button"
                  >
                    <Save className="h-4 w-4" />
                    {updateMutation.isPending ? "Saving..." : "Save audited update"}
                  </Button>
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
