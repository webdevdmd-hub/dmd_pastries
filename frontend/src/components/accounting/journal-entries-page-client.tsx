"use client";

import { Eye, FilePlus2, Pencil, Plus, RotateCcw, Send, Trash2 } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccountingAccessDeniedCard } from "@/components/accounting/accounting-access-denied-card";
import { PageHeader } from "@/components/shared/page-header";
import type { SearchableComboboxOption } from "@/components/shared/searchable-combobox";
import { SearchableCombobox } from "@/components/shared/searchable-combobox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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
  useChartAccounts,
  useCreateJournalEntry,
  useJournalEntries,
  useJournalEntry,
  usePostJournalEntry,
  useReverseJournalEntry,
  useUpdateJournalEntry,
} from "@/hooks/use-accounting";
import { useBranches } from "@/hooks/use-branches";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api/client";
import { journalEntrySchema } from "@/lib/validators/accounting.schema";
import type {
  ChartAccount,
  CreateJournalEntryPayload,
  JournalEntriesFilters,
  JournalEntry,
  JournalEntryStatus,
  UpdateJournalEntryPayload,
} from "@/types/accounting";
import type { Branch } from "@/types/branch";

const noBranchValue = "__none__";

const defaultFilters: JournalEntriesFilters = {
  branchId: "",
  dateFrom: "",
  dateTo: "",
  limit: 25,
  page: 1,
  search: "",
  sortBy: "entry_date",
  sortOrder: "desc",
  sourceType: "",
  status: "all",
};

type PendingAction =
  | { entry: JournalEntry; type: "post" }
  | { entry: JournalEntry; type: "reverse" }
  | null;

type LineFormState = {
  accountId: string;
  creditAmount: string;
  debitAmount: string;
  description: string;
};

type EntryFormState = {
  branchId: string;
  entryDate: string;
  lines: LineFormState[];
  narration: string;
  referenceNumber: string;
};

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyLine(): LineFormState {
  return {
    accountId: "",
    creditAmount: "",
    debitAmount: "",
    description: "",
  };
}

function emptyEntryFormState(): EntryFormState {
  return {
    branchId: noBranchValue,
    entryDate: "",
    lines: [emptyLine(), emptyLine()],
    narration: "",
    referenceNumber: "",
  };
}

function entryToFormState(entry: JournalEntry | null): EntryFormState {
  if (!entry) {
    return {
      ...emptyEntryFormState(),
      entryDate: todayInputValue(),
    };
  }

  return {
    branchId: entry.branchId ?? noBranchValue,
    entryDate: entry.entryDate,
    lines:
      entry.lines.length > 0
        ? entry.lines.map((line) => ({
            accountId: line.accountId,
            creditAmount: line.creditAmount > 0 ? String(line.creditAmount) : "",
            debitAmount: line.debitAmount > 0 ? String(line.debitAmount) : "",
            description: line.description,
          }))
        : [emptyLine(), emptyLine()],
    narration: entry.narration,
    referenceNumber: entry.referenceNumber,
  };
}

function numberFromInput(value: string): number {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function money(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    style: "currency",
  }).format(value);
}

function statusBadgeVariant(status: JournalEntryStatus): "default" | "outline" | "secondary" {
  if (status === "posted") return "default";
  if (status === "reversed") return "secondary";
  return "outline";
}

function statusLabel(status: JournalEntryStatus): string {
  return status
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function toPayload(state: EntryFormState): CreateJournalEntryPayload {
  return {
    branchId: state.branchId === noBranchValue ? null : state.branchId,
    entryDate: state.entryDate,
    lines: state.lines.map((line) => ({
      accountId: line.accountId,
      creditAmount: numberFromInput(line.creditAmount),
      debitAmount: numberFromInput(line.debitAmount),
      description: line.description,
    })),
    narration: state.narration,
    referenceNumber: state.referenceNumber,
    sourceId: null,
    sourceType: "manual",
  };
}

function usableAccounts(accounts: ChartAccount[]): ChartAccount[] {
  return accounts.filter((account) => account.status === "active" && account.allowManualPosting);
}

function mergeAccounts(...groups: ChartAccount[][]): ChartAccount[] {
  const merged = new Map<string, ChartAccount>();

  groups.flat().forEach((account) => {
    if (account.id) {
      merged.set(account.id, account);
    }
  });

  return Array.from(merged.values()).sort((first, second) =>
    first.accountCode.localeCompare(second.accountCode),
  );
}

function accountMatchesSearch(account: ChartAccount, search: string): boolean {
  const normalizedSearch = search.trim().toLowerCase();

  if (normalizedSearch.length === 0) {
    return true;
  }

  return [
    account.accountCode,
    account.accountName,
    account.accountType,
    account.accountGroup,
    account.normalBalance,
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalizedSearch);
}

function JournalEntryFormDialog({
  accounts,
  branches,
  entry,
  isLoadingEntry,
  isSubmitting,
  onClose,
  onCreate,
  onUpdate,
  open,
}: {
  accounts: ChartAccount[];
  branches: Branch[];
  entry: JournalEntry | null;
  isLoadingEntry: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onCreate: (payload: CreateJournalEntryPayload) => Promise<void>;
  onUpdate: (id: string, payload: UpdateJournalEntryPayload) => Promise<void>;
  open: boolean;
}): JSX.Element {
  const [formState, setFormState] = useState<EntryFormState>(emptyEntryFormState());
  const [error, setError] = useState<string | null>(null);
  const [accountSearch, setAccountSearch] = useState("");
  const [knownAccounts, setKnownAccounts] = useState<ChartAccount[]>([]);
  const isEditing = entry !== null;
  const accountSearchQuery = useChartAccounts(
    {
      accountGroup: "",
      accountType: "all",
      limit: 100,
      page: 1,
      parentAccountId: "",
      search: accountSearch,
      sortBy: "account_code",
      sortOrder: "asc",
      status: "active",
    },
    open,
  );
  const accountOptions = usableAccounts(
    mergeAccounts(knownAccounts, accountSearchQuery.data?.items ?? []),
  ).filter((account) => accountMatchesSearch(account, accountSearch));
  const accountComboboxOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      accountOptions.map((account) => ({
        description: `${account.accountType} · ${account.accountGroup || "No group"} · ${account.normalBalance}`,
        keywords: [
          account.accountCode,
          account.accountName,
          account.accountType,
          account.accountGroup,
          account.normalBalance,
        ],
        label: `${account.accountCode} - ${account.accountName}`,
        value: account.id,
      })),
    [accountOptions],
  );
  const totalDebit = formState.lines.reduce(
    (sum, line) => sum + numberFromInput(line.debitAmount),
    0,
  );
  const totalCredit = formState.lines.reduce(
    (sum, line) => sum + numberFromInput(line.creditAmount),
    0,
  );
  const isBalanced = Math.abs(totalDebit - totalCredit) <= 0.005 && totalDebit > 0;

  useEffect(() => {
    if (open && !isLoadingEntry) {
      setFormState(entryToFormState(entry));
      setError(null);
      setKnownAccounts(accounts);
    }
  }, [accounts, entry, isLoadingEntry, open]);

  useEffect(() => {
    if (accountSearchQuery.data?.items) {
      setKnownAccounts((current) => mergeAccounts(current, accountSearchQuery.data.items));
    }
  }, [accountSearchQuery.data]);

  const updateLine = (index: number, patch: Partial<LineFormState>): void => {
    setFormState((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    }));
  };

  const removeLine = (index: number): void => {
    setFormState((current) => ({
      ...current,
      lines:
        current.lines.length <= 2
          ? current.lines
          : current.lines.filter((_, lineIndex) => lineIndex !== index),
    }));
  };

  const submitForm = async (): Promise<void> => {
    const payload = toPayload(formState);
    const result = journalEntrySchema.safeParse(payload);

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Please check the journal entry.");
      return;
    }

    setError(null);

    if (entry) {
      await onUpdate(entry.id, result.data);
      return;
    }

    await onCreate(result.data);
  };

  return (
    <Dialog onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)} open={open}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit draft journal entry" : "Create journal entry"}
          </DialogTitle>
          <DialogDescription>
            Manual voucher entry. Debits and credits must balance before saving.
          </DialogDescription>
        </DialogHeader>

        {isLoadingEntry ? (
          <div className="grid gap-3">
            <Skeleton className="h-12 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        ) : (
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submitForm();
            }}
          >
            <div className="grid gap-3 md:grid-cols-4">
              <div className="grid gap-2">
                <Label>Branch</Label>
                <Select
                  onValueChange={(branchId) =>
                    setFormState((current) => ({ ...current, branchId }))
                  }
                  value={formState.branchId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Business-level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={noBranchValue}>Business-level</SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name} ({branch.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="entryDate">Entry date</Label>
                <Input
                  id="entryDate"
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, entryDate: event.target.value }))
                  }
                  type="date"
                  value={formState.entryDate}
                />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="referenceNumber">Reference number</Label>
                <Input
                  id="referenceNumber"
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      referenceNumber: event.target.value,
                    }))
                  }
                  placeholder="JV-MANUAL-001"
                  value={formState.referenceNumber}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="narration">Narration</Label>
              <Input
                id="narration"
                onChange={(event) =>
                  setFormState((current) => ({ ...current, narration: event.target.value }))
                }
                placeholder="Manual expense voucher"
                value={formState.narration}
              />
            </div>

            <div className="overflow-x-auto rounded-2xl border border-brand-cappuccino/70">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-72">Account</TableHead>
                    <TableHead className="min-w-36">Debit</TableHead>
                    <TableHead className="min-w-36">Credit</TableHead>
                    <TableHead className="min-w-72">Description</TableHead>
                    <TableHead className="w-16 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formState.lines.map((line, index) => (
                    <TableRow key={`journal-line-${String(index)}`}>
                      <TableCell>
                        <SearchableCombobox
                          emptyMessage="No active manual-posting accounts found."
                          isLoading={accountSearchQuery.isFetching}
                          groupLabel="Posting accounts"
                          onValueChange={(accountId) => updateLine(index, { accountId })}
                          onSearchChange={setAccountSearch}
                          options={accountComboboxOptions}
                          placeholder="Select account"
                          searchValue={accountSearch}
                          searchPlaceholder="Search code, account, type, group..."
                          value={line.accountId}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          min="0"
                          onChange={(event) =>
                            updateLine(index, {
                              creditAmount: event.target.value ? "" : line.creditAmount,
                              debitAmount: event.target.value,
                            })
                          }
                          placeholder="0.00"
                          step="0.01"
                          type="number"
                          value={line.debitAmount}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          min="0"
                          onChange={(event) =>
                            updateLine(index, {
                              creditAmount: event.target.value,
                              debitAmount: event.target.value ? "" : line.debitAmount,
                            })
                          }
                          placeholder="0.00"
                          step="0.01"
                          type="number"
                          value={line.creditAmount}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          onChange={(event) =>
                            updateLine(index, { description: event.target.value })
                          }
                          placeholder="Line description"
                          value={line.description}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          aria-label={`Remove line ${String(index + 1)}`}
                          disabled={formState.lines.length <= 2}
                          onClick={() => removeLine(index)}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-brand-cappuccino/70 bg-brand-latte/40 p-4 md:flex-row md:items-center md:justify-between">
              <Button
                onClick={() =>
                  setFormState((current) => ({
                    ...current,
                    lines: [...current.lines, emptyLine()],
                  }))
                }
                type="button"
                variant="outline"
              >
                <Plus className="h-4 w-4" />
                Add line
              </Button>
              <div className="flex flex-wrap gap-3 text-sm">
                <span>
                  Debit: <strong>{money(totalDebit)}</strong>
                </span>
                <span>
                  Credit: <strong>{money(totalCredit)}</strong>
                </span>
                <Badge variant={isBalanced ? "default" : "outline"}>
                  {isBalanced ? "Balanced" : "Not balanced"}
                </Badge>
              </div>
            </div>

            {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}

            <DialogFooter>
              <Button onClick={onClose} type="button" variant="outline">
                Cancel
              </Button>
              <Button disabled={isSubmitting || !isBalanced} type="submit">
                {isSubmitting ? "Saving..." : isEditing ? "Save draft" : "Create draft"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function JournalEntryDetailsDialog({
  entry,
  isLoading,
  onClose,
  open,
}: {
  entry: JournalEntry | null;
  isLoading: boolean;
  onClose: () => void;
  open: boolean;
}): JSX.Element {
  return (
    <Dialog onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)} open={open}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Journal entry details</DialogTitle>
          <DialogDescription>
            Review voucher header, status, totals, and accounting lines.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-72 rounded-2xl" />
        ) : entry ? (
          <div className="grid gap-4">
            <div className="grid gap-3 rounded-2xl border border-brand-cappuccino/70 bg-brand-latte/40 p-4 md:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-brand-mocha">Entry</p>
                <p className="font-semibold text-brand-espresso">{entry.entryNumber}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-brand-mocha">Date</p>
                <p className="font-semibold text-brand-espresso">{entry.entryDate}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-brand-mocha">Branch</p>
                <p className="font-semibold text-brand-espresso">
                  {entry.branchName || "Business-level"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-brand-mocha">Status</p>
                <Badge variant={statusBadgeVariant(entry.status)}>
                  {statusLabel(entry.status)}
                </Badge>
              </div>
            </div>

            <p className="text-sm text-brand-mocha">{entry.narration}</p>

            <div className="overflow-x-auto rounded-2xl border border-brand-cappuccino/70">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entry.lines.map((line) => (
                    <TableRow key={line.id || `${line.accountId}-${String(line.lineNumber)}`}>
                      <TableCell>
                        <span className="font-semibold text-brand-espresso">
                          {line.accountCode} - {line.accountName}
                        </span>
                      </TableCell>
                      <TableCell className="text-brand-mocha">{line.description || "-"}</TableCell>
                      <TableCell className="text-right">{money(line.debitAmount)}</TableCell>
                      <TableCell className="text-right">{money(line.creditAmount)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={2} className="font-bold text-brand-espresso">
                      Total
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {money(entry.totalDebit)}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {money(entry.totalCredit)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function JournalEntriesPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([
    PERMISSIONS.accountingView,
    PERMISSIONS.accountingJournalEntriesManage,
  ]);
  const canManage = hasAnyPermission([PERMISSIONS.accountingJournalEntriesManage]);
  const canLoadBranches = hasAnyPermission([PERMISSIONS.branchesView, PERMISSIONS.branchesSwitch]);
  const [filters, setFilters] = useState<JournalEntriesFilters>(defaultFilters);
  const [formOpen, setFormOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const entriesQuery = useJournalEntries(filters, canView);
  const entryQuery = useJournalEntry(selectedEntryId, selectedEntryId !== null);
  const branchesQuery = useBranches(canView && canLoadBranches);
  const accountsQuery = useChartAccounts(
    {
      accountGroup: "",
      accountType: "all",
      limit: 500,
      page: 1,
      parentAccountId: "",
      search: "",
      sortBy: "account_code",
      sortOrder: "asc",
      status: "active",
    },
    canView,
  );
  const createMutation = useCreateJournalEntry();
  const updateMutation = useUpdateJournalEntry();
  const postMutation = usePostJournalEntry();
  const reverseMutation = useReverseJournalEntry();
  const entries = entriesQuery.data?.items ?? [];
  const totalEntries = entriesQuery.data?.total ?? entries.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / filters.limit));
  const activeBranches = (branchesQuery.data ?? []).filter((branch) => branch.status === "active");
  const selectedEntry = entryQuery.data ?? null;

  const updateFilters = (patch: Partial<JournalEntriesFilters>, resetPage = true): void => {
    setFilters((current) => ({
      ...current,
      ...patch,
      ...(resetPage ? { page: 1 } : {}),
    }));
  };

  if (!canView) {
    return (
      <AccountingAccessDeniedCard message="You need `accounting.view` to view Journal Entries." />
    );
  }

  const handleCreate = async (payload: CreateJournalEntryPayload): Promise<void> => {
    try {
      await createMutation.mutateAsync(payload);
      toast.success("Journal entry draft created.");
      setFormOpen(false);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleUpdate = async (id: string, payload: UpdateJournalEntryPayload): Promise<void> => {
    try {
      await updateMutation.mutateAsync({ id, payload });
      toast.success("Journal entry draft updated.");
      setFormOpen(false);
      setSelectedEntryId(null);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  const confirmAction = async (): Promise<void> => {
    if (!pendingAction) return;

    try {
      if (pendingAction.type === "post") {
        await postMutation.mutateAsync(pendingAction.entry.id);
        toast.success("Journal entry posted.");
      } else {
        await reverseMutation.mutateAsync(pendingAction.entry.id);
        toast.success("Journal entry reversed.");
      }

      setPendingAction(null);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        actions={
          canManage ? (
            <Button
              onClick={() => {
                setSelectedEntryId(null);
                setFormOpen(true);
              }}
              type="button"
            >
              <FilePlus2 className="h-4 w-4" />
              Create Journal Entry
            </Button>
          ) : undefined
        }
        description="Create and manage balanced debit/credit manual accounting vouchers."
        title="Journal Entries"
      />

      <Alert>
        <FilePlus2 className="h-4 w-4" />
        <AlertTitle>Manual voucher entry</AlertTitle>
        <AlertDescription>
          Draft entries can be edited. Posted entries are locked and can only be reversed.
        </AlertDescription>
      </Alert>

      <div className="grid gap-3 rounded-2xl border border-brand-cappuccino/60 bg-white/80 p-4 lg:grid-cols-[1.5fr_repeat(5,minmax(0,1fr))]">
        <Input
          aria-label="Search journal entries"
          onChange={(event) => updateFilters({ search: event.target.value })}
          placeholder="Search entry, reference, narration..."
          value={filters.search}
        />
        <Select
          onValueChange={(status: JournalEntriesFilters["status"]) => updateFilters({ status })}
          value={filters.status}
        >
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="posted">Posted</SelectItem>
            <SelectItem value="reversed">Reversed</SelectItem>
          </SelectContent>
        </Select>
        <Select
          onValueChange={(sourceType) => updateFilters({ sourceType })}
          value={filters.sourceType || "all"}
        >
          <SelectTrigger>
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>
        <Input
          aria-label="Date from"
          onChange={(event) => updateFilters({ dateFrom: event.target.value })}
          type="date"
          value={filters.dateFrom}
        />
        <Input
          aria-label="Date to"
          onChange={(event) => updateFilters({ dateTo: event.target.value })}
          type="date"
          value={filters.dateTo}
        />
        <div className="flex gap-2">
          <Select onValueChange={(sortBy) => updateFilters({ sortBy })} value={filters.sortBy}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="entry_date">Entry date</SelectItem>
              <SelectItem value="entry_number">Entry number</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="total_debit">Total debit</SelectItem>
              <SelectItem value="created_at">Created</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setFilters(defaultFilters)} type="button" variant="outline">
            Reset
          </Button>
        </div>
      </div>

      {entriesQuery.isLoading ? (
        <div className="grid gap-3">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-72 rounded-3xl" />
        </div>
      ) : null}

      {!entriesQuery.isLoading && entriesQuery.error ? (
        <Card className="border-red-200 bg-red-50/70">
          <CardContent className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
            <h2 className="text-2xl font-semibold text-brand-espresso">
              Unable to load Journal Entries
            </h2>
            <p className="max-w-xl text-sm text-brand-mocha">
              {getErrorMessage(entriesQuery.error)}
            </p>
            <Button onClick={() => void entriesQuery.refetch()} type="button" variant="outline">
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!entriesQuery.isLoading && !entriesQuery.error && entries.length === 0 ? (
        <Card className="border-brand-cappuccino/70 bg-white/80">
          <CardContent className="flex min-h-72 flex-col items-center justify-center gap-4 text-center">
            <div className="rounded-2xl bg-brand-latte p-4 text-brand-mocha">
              <FilePlus2 className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-brand-espresso">
                No journal entries found.
              </h2>
              <p className="mt-2 max-w-xl text-sm text-brand-mocha">
                Create a balanced manual voucher to start recording accounting entries.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!entriesQuery.isLoading && !entriesQuery.error && entries.length > 0 ? (
        <Card className="overflow-hidden border-brand-cappuccino/70 bg-white/85">
          <CardContent className="overflow-hidden p-0">
            <div className="flex flex-col gap-2 border-b border-brand-cappuccino/70 bg-white/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-brand-espresso">Voucher list</p>
                <p className="text-xs text-brand-mocha">
                  Showing {entries.length} of {totalEntries} entries
                </p>
              </div>
              <p className="text-xs text-brand-mocha">
                Page {filters.page} of {totalPages}
              </p>
            </div>
            <div className="overflow-x-auto bg-white/75 [&>div]:rounded-none">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entry</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <span className="block font-bold text-brand-espresso">
                          {entry.entryNumber || "Draft entry"}
                        </span>
                        <span className="block max-w-xs truncate text-xs text-brand-mocha">
                          {entry.referenceNumber || entry.narration}
                        </span>
                      </TableCell>
                      <TableCell>{entry.entryDate}</TableCell>
                      <TableCell>{entry.branchName || "Business-level"}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(entry.status)}>
                          {statusLabel(entry.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{money(entry.totalDebit)}</TableCell>
                      <TableCell className="text-right">{money(entry.totalCredit)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" type="button" variant="ghost">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuLabel>Journal actions</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedEntryId(entry.id);
                                setDetailsOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                              View details
                            </DropdownMenuItem>
                            {canManage && entry.status === "draft" ? (
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedEntryId(entry.id);
                                  setFormOpen(true);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                                Edit draft
                              </DropdownMenuItem>
                            ) : null}
                            {canManage && entry.status === "draft" ? (
                              <DropdownMenuItem
                                onClick={() => setPendingAction({ entry, type: "post" })}
                              >
                                <Send className="h-4 w-4" />
                                Post entry
                              </DropdownMenuItem>
                            ) : null}
                            {canManage && entry.status === "posted" ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-700 focus:text-red-800"
                                  onClick={() => setPendingAction({ entry, type: "reverse" })}
                                >
                                  <RotateCcw className="h-4 w-4" />
                                  Reverse entry
                                </DropdownMenuItem>
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-col gap-3 border-t border-brand-cappuccino/70 bg-white/80 px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-brand-mocha">Rows per page</span>
                <Select
                  onValueChange={(value) => updateFilters({ limit: Number(value) })}
                  value={String(filters.limit)}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-3 md:justify-end">
                <Button
                  disabled={filters.page <= 1 || entriesQuery.isFetching}
                  onClick={() => updateFilters({ page: Math.max(1, filters.page - 1) }, false)}
                  type="button"
                  variant="outline"
                >
                  Previous
                </Button>
                <span className="min-w-28 text-center text-sm text-brand-mocha">
                  {filters.page} / {totalPages}
                </span>
                <Button
                  disabled={filters.page >= totalPages || entriesQuery.isFetching}
                  onClick={() => updateFilters({ page: filters.page + 1 }, false)}
                  type="button"
                  variant="outline"
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <JournalEntryFormDialog
        accounts={accountsQuery.data?.items ?? []}
        branches={activeBranches}
        entry={selectedEntryId && formOpen ? selectedEntry : null}
        isLoadingEntry={selectedEntryId !== null && formOpen && entryQuery.isLoading}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        onClose={() => {
          setFormOpen(false);
          setSelectedEntryId(null);
        }}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        open={formOpen}
      />

      <JournalEntryDetailsDialog
        entry={selectedEntryId && detailsOpen ? selectedEntry : null}
        isLoading={selectedEntryId !== null && detailsOpen && entryQuery.isLoading}
        onClose={() => {
          setDetailsOpen(false);
          setSelectedEntryId(null);
        }}
        open={detailsOpen}
      />

      <Dialog
        onOpenChange={(open) => (!open ? setPendingAction(null) : undefined)}
        open={pendingAction !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction?.type === "post" ? "Post journal entry?" : "Reverse journal entry?"}
            </DialogTitle>
            <DialogDescription>
              {pendingAction?.type === "post"
                ? "Posted entries cannot be edited after posting."
                : "A reversal creates a new opposite posted journal entry."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setPendingAction(null)} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              className={pendingAction?.type === "reverse" ? "border-red-200 text-red-700" : ""}
              disabled={postMutation.isPending || reverseMutation.isPending}
              onClick={() => void confirmAction()}
              type="button"
              variant={pendingAction?.type === "reverse" ? "outline" : "default"}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
