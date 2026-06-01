"use client";

import {
  FilePlus2,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccountingAccessDeniedCard } from "@/components/accounting/accounting-access-denied-card";
import { PageHeader } from "@/components/shared/page-header";
import type { SearchableComboboxOption } from "@/components/shared/searchable-combobox";
import { SearchableCombobox } from "@/components/shared/searchable-combobox";
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
import { ROUTES } from "@/constants/routes";
import {
  useChartAccounts,
  useCreateJournalEntry,
  useDeleteJournalEntry,
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
  | { entry: JournalEntry; type: "delete" }
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

function formatDate(value: string): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value))
    : "-";
}

function displayText(value: string, fallback = "-"): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
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

function sourceLabel(sourceType: string): string {
  return sourceType
    .split("_")
    .filter((part) => part.length > 0)
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

function JournalEntryDetailsPanel({
  canManage,
  entry,
  isLoading,
  onDelete,
  onEdit,
  onPost,
  onReverse,
}: {
  canManage: boolean;
  entry: JournalEntry | null;
  isLoading: boolean;
  onDelete: (entry: JournalEntry) => void;
  onEdit: (entry: JournalEntry) => void;
  onPost: (entry: JournalEntry) => void;
  onReverse: (entry: JournalEntry) => void;
}): JSX.Element {
  if (isLoading) {
    return (
      <div className="grid gap-4 p-6">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-72 rounded-3xl" />
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="flex min-h-[620px] flex-col items-center justify-center gap-3 p-8 text-center">
        <FilePlus2 className="h-12 w-12 text-brand-mocha" />
        <p className="text-xl font-semibold text-brand-espresso">Select a journal entry</p>
        <p className="max-w-md text-sm text-brand-mocha">
          Choose a manual journal from the list to review voucher details and accounting lines.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-white">
      <div className="flex flex-col gap-4 border-b border-brand-cappuccino/60 bg-brand-latte/20 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-mocha">
            {entry.sourceType === "manual" ? "Manual Journal" : sourceLabel(entry.sourceType)}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h2 className="text-3xl font-bold tracking-tight text-brand-espresso">
              {displayText(entry.entryNumber, "Draft journal")}
            </h2>
            <Badge variant={statusBadgeVariant(entry.status)}>{statusLabel(entry.status)}</Badge>
          </div>
          <p className="mt-1 text-sm text-brand-mocha">
            {formatDate(entry.entryDate)} | {displayText(entry.branchName, "Business-level")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canManage && entry.status === "draft" ? (
            <>
              <Button onClick={() => onEdit(entry)} type="button" variant="outline">
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              <Button onClick={() => onPost(entry)} type="button">
                <Send className="h-4 w-4" />
                Post
              </Button>
            </>
          ) : null}
          {canManage && entry.status === "posted" ? (
            <Button onClick={() => onReverse(entry)} type="button" variant="outline">
              <RotateCcw className="h-4 w-4" />
              Reverse
            </Button>
          ) : null}
          {canManage && entry.sourceType === "manual" ? (
            <Button
              className="border-red-200 text-red-700 hover:bg-red-50"
              onClick={() => onDelete(entry)}
              type="button"
              variant="outline"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          ) : null}
          {entry.sourceType === "expense" && entry.sourceId ? (
            <Button asChild type="button" variant="outline">
              <Link href={`${ROUTES.expenses}/${entry.sourceId}`}>
                <FilePlus2 className="h-4 w-4" />
                Source expense
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 px-6 py-6">
        <Card className="overflow-hidden border-brand-cappuccino/70 bg-white shadow-none">
          <CardContent className="grid gap-6 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-2xl font-bold text-brand-espresso">
                  {displayText(entry.entryNumber, "Draft journal")}
                </span>
                <Badge variant={statusBadgeVariant(entry.status)}>
                  {statusLabel(entry.status)}
                </Badge>
              </div>
              <div className="rounded-full border border-brand-cappuccino/70 px-3 py-1 text-xs font-medium text-brand-mocha">
                Reporting Method: Accrual and Cash
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="grid grid-cols-[160px_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">
                <span className="text-brand-mocha">Journal#</span>
                <span className="font-medium text-brand-espresso">
                  {displayText(entry.entryNumber)}
                </span>
                <span className="text-brand-mocha">Journal Date</span>
                <span className="font-medium text-brand-espresso">
                  {formatDate(entry.entryDate)}
                </span>
                <span className="text-brand-mocha">Currency</span>
                <span className="font-medium text-brand-espresso">AED</span>
                <span className="text-brand-mocha">Notes</span>
                <span className="font-medium text-brand-espresso">
                  {displayText(entry.narration, "No notes")}
                </span>
              </div>
              <div className="grid grid-cols-[170px_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">
                <span className="text-brand-mocha">Reference Number</span>
                <span className="font-medium text-brand-espresso">
                  {displayText(entry.referenceNumber)}
                </span>
                <span className="text-brand-mocha">Transaction Type</span>
                <span className="font-medium text-brand-espresso">
                  {entry.sourceType === "manual" ? "Journal" : sourceLabel(entry.sourceType)}
                </span>
                <span className="text-brand-mocha">Branch</span>
                <span className="font-medium text-brand-espresso">
                  {displayText(entry.branchName, "Business-level")}
                </span>
                <span className="text-brand-mocha">Created</span>
                <span className="font-medium text-brand-espresso">
                  {formatDate(entry.createdAt)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-brand-cappuccino/70 bg-white shadow-none">
          <CardContent className="p-0">
            <div className="border-b border-brand-cappuccino/60 px-4 py-4">
              <h3 className="text-xl font-semibold text-brand-espresso">Journal Details</h3>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
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
                      <TableCell className="text-brand-mocha">
                        {displayText(line.description)}
                      </TableCell>
                      <TableCell className="text-right">
                        {line.debitAmount > 0 ? money(line.debitAmount) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {line.creditAmount > 0 ? money(line.creditAmount) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={2} className="text-right font-semibold text-brand-mocha">
                      Sub Total
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {money(entry.totalDebit)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {money(entry.totalCredit)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell
                      colSpan={2}
                      className="text-right text-lg font-bold text-brand-espresso"
                    >
                      Total Amount
                    </TableCell>
                    <TableCell className="text-right text-lg font-bold text-brand-espresso">
                      {money(entry.totalDebit)}
                    </TableCell>
                    <TableCell className="text-right text-lg font-bold text-brand-espresso">
                      {money(entry.totalCredit)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function JournalEntriesPageClient(): JSX.Element {
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get("search") ?? "";
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([
    PERMISSIONS.accountingView,
    PERMISSIONS.accountingJournalEntriesManage,
  ]);
  const canManage = hasAnyPermission([PERMISSIONS.accountingJournalEntriesManage]);
  const canLoadBranches = hasAnyPermission([PERMISSIONS.branchesView, PERMISSIONS.branchesSwitch]);
  const [filters, setFilters] = useState<JournalEntriesFilters>(() => ({
    ...defaultFilters,
    search: urlSearch,
  }));
  const [formOpen, setFormOpen] = useState(false);
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
  const deleteMutation = useDeleteJournalEntry();
  const entries = useMemo(() => entriesQuery.data?.items ?? [], [entriesQuery.data?.items]);
  const totalEntries = entriesQuery.data?.total ?? entries.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / filters.limit));
  const activeBranches = (branchesQuery.data ?? []).filter((branch) => branch.status === "active");
  const selectedSummaryEntry =
    entries.find((entry) => entry.id === selectedEntryId) ?? entries[0] ?? null;
  const selectedEntry = entryQuery.data ?? selectedSummaryEntry;

  useEffect(() => {
    setFilters((current) =>
      current.search === urlSearch ? current : { ...current, page: 1, search: urlSearch },
    );
  }, [urlSearch]);

  useEffect(() => {
    if (entries.length === 0) {
      if (selectedEntryId !== null) {
        setSelectedEntryId(null);
      }
      return;
    }

    if (selectedEntryId === null || !entries.some((entry) => entry.id === selectedEntryId)) {
      setSelectedEntryId(entries[0]?.id ?? null);
    }
  }, [entries, selectedEntryId]);

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
        if (pendingAction.type === "delete") {
          await deleteMutation.mutateAsync(pendingAction.entry.id);
          toast.success("Manual journal entry deleted.");
          setSelectedEntryId(null);
          setPendingAction(null);
          return;
        }
        await reverseMutation.mutateAsync(pendingAction.entry.id);
        toast.success("Journal entry reversed.");
      }

      setPendingAction(null);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5">
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

      <Card className="overflow-hidden rounded-3xl border-brand-cappuccino/70 bg-white shadow-sm">
        <CardContent className="p-0">
          <div className="grid min-h-[720px] lg:grid-cols-[420px_minmax(0,1fr)]">
            <aside className="flex min-h-[720px] flex-col border-b border-brand-cappuccino/70 bg-white lg:border-b-0 lg:border-r">
              <div className="flex items-center justify-between gap-3 border-b border-brand-cappuccino/70 px-4 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-brand-espresso">All Manual Journals</h2>
                    <Badge variant="outline">{totalEntries}</Badge>
                  </div>
                  <p className="text-xs text-brand-mocha">
                    Draft, posted, reversed, and source vouchers.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {canManage ? (
                    <Button
                      aria-label="Create journal entry"
                      onClick={() => {
                        setSelectedEntryId(null);
                        setFormOpen(true);
                      }}
                      size="icon"
                      type="button"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  ) : null}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        aria-label="Journal options"
                        size="icon"
                        type="button"
                        variant="outline"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => void entriesQuery.refetch()}>
                        Refresh list
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setFilters(defaultFilters)}>
                        Reset filters
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="grid gap-3 border-b border-brand-cappuccino/70 bg-brand-latte/25 p-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mocha" />
                  <Input
                    aria-label="Search journal entries"
                    className="pl-9"
                    onChange={(event) => updateFilters({ search: event.target.value })}
                    placeholder="Search journal, reference, notes..."
                    value={filters.search}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    onValueChange={(status: JournalEntriesFilters["status"]) =>
                      updateFilters({ status })
                    }
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
                    onValueChange={(sourceType) =>
                      updateFilters({ sourceType: sourceType === "all" ? "" : sourceType })
                    }
                    value={filters.sourceType || "all"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sources</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Select
                  onValueChange={(branchId) =>
                    updateFilters({ branchId: branchId === "all" ? "" : branchId })
                  }
                  value={filters.branchId || "all"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All branches</SelectItem>
                    {activeBranches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name} ({branch.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-2">
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
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {entriesQuery.isLoading ? (
                  <div className="grid gap-3 p-4">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Skeleton key={String(index)} className="h-24 rounded-2xl" />
                    ))}
                  </div>
                ) : null}

                {!entriesQuery.isLoading && entriesQuery.error ? (
                  <div className="flex min-h-80 flex-col items-center justify-center gap-3 p-6 text-center">
                    <FilePlus2 className="h-10 w-10 text-red-700" />
                    <p className="font-semibold text-brand-espresso">
                      Unable to load journal entries
                    </p>
                    <p className="text-sm text-brand-mocha">
                      {getErrorMessage(entriesQuery.error)}
                    </p>
                    <Button
                      onClick={() => void entriesQuery.refetch()}
                      type="button"
                      variant="outline"
                    >
                      Retry
                    </Button>
                  </div>
                ) : null}

                {!entriesQuery.isLoading && !entriesQuery.error && entries.length === 0 ? (
                  <div className="flex min-h-80 flex-col items-center justify-center gap-3 p-6 text-center">
                    <div className="rounded-2xl bg-brand-latte p-4 text-brand-mocha">
                      <FilePlus2 className="h-8 w-8" />
                    </div>
                    <p className="font-semibold text-brand-espresso">No journal entries found.</p>
                    <p className="text-sm text-brand-mocha">
                      Create a balanced voucher or adjust filters.
                    </p>
                  </div>
                ) : null}

                {!entriesQuery.isLoading && !entriesQuery.error && entries.length > 0 ? (
                  <div className="divide-y divide-brand-cappuccino/60">
                    {entries.map((entry) => {
                      const isSelected = entry.id === selectedEntryId;

                      return (
                        <button
                          key={entry.id}
                          className={`flex w-full flex-col gap-2 px-4 py-4 text-left transition ${
                            isSelected
                              ? "bg-brand-latte/75 shadow-[inset_4px_0_0_#B08968]"
                              : "bg-white hover:bg-brand-latte/30"
                          }`}
                          onClick={() => setSelectedEntryId(entry.id)}
                          type="button"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-brand-espresso">
                                {displayText(entry.entryNumber, "Draft journal")}
                              </p>
                              <p className="mt-1 text-xs text-brand-mocha">
                                {formatDate(entry.entryDate)}
                              </p>
                            </div>
                            <Badge variant={statusBadgeVariant(entry.status)}>
                              {statusLabel(entry.status)}
                            </Badge>
                          </div>
                          <div className="flex items-end justify-between gap-3">
                            <p className="min-w-0 truncate text-xs text-brand-mocha">
                              {displayText(
                                entry.referenceNumber || entry.narration,
                                "No reference",
                              )}
                            </p>
                            <p className="whitespace-nowrap text-sm font-bold text-brand-espresso">
                              {money(entry.totalDebit)}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-brand-cappuccino/70 bg-white px-4 py-3">
                <Button
                  disabled={filters.page <= 1 || entriesQuery.isFetching}
                  onClick={() => updateFilters({ page: Math.max(1, filters.page - 1) }, false)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Previous
                </Button>
                <span className="text-xs font-medium text-brand-mocha">
                  Page {filters.page} of {totalPages}
                </span>
                <Button
                  disabled={filters.page >= totalPages || entriesQuery.isFetching}
                  onClick={() => updateFilters({ page: filters.page + 1 }, false)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Next
                </Button>
              </div>
            </aside>

            <JournalEntryDetailsPanel
              canManage={canManage}
              entry={selectedEntry}
              isLoading={selectedEntryId !== null && entryQuery.isLoading}
              onDelete={(entry) => setPendingAction({ entry, type: "delete" })}
              onEdit={(entry) => {
                setSelectedEntryId(entry.id);
                setFormOpen(true);
              }}
              onPost={(entry) => setPendingAction({ entry, type: "post" })}
              onReverse={(entry) => setPendingAction({ entry, type: "reverse" })}
            />
          </div>
        </CardContent>
      </Card>

      <JournalEntryFormDialog
        accounts={accountsQuery.data?.items ?? []}
        branches={activeBranches}
        entry={selectedEntryId !== null && formOpen ? selectedEntry : null}
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

      <Dialog
        onOpenChange={(open) => (!open ? setPendingAction(null) : undefined)}
        open={pendingAction !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction?.type === "post"
                ? "Post journal entry?"
                : pendingAction?.type === "delete"
                  ? "Delete manual journal entry?"
                  : "Reverse journal entry?"}
            </DialogTitle>
            <DialogDescription>
              {pendingAction?.type === "post"
                ? "Posted entries cannot be edited after posting."
                : pendingAction?.type === "delete"
                  ? "Manual journals are permanently deleted. System-generated journals must be deleted through their source document."
                  : "A reversal creates a new opposite posted journal entry."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setPendingAction(null)} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              className={pendingAction?.type === "reverse" ? "border-red-200 text-red-700" : ""}
              disabled={
                postMutation.isPending || reverseMutation.isPending || deleteMutation.isPending
              }
              onClick={() => void confirmAction()}
              type="button"
              variant={
                pendingAction?.type === "reverse" || pendingAction?.type === "delete"
                  ? "outline"
                  : "default"
              }
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
