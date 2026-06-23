"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import { PurchaseEmptyState } from "@/components/purchasing/purchase-empty-state";
import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import { PurchaseInvoiceFormDialog } from "@/components/purchasing/purchase-invoice-form-dialog";
import { PurchaseInvoicesTable } from "@/components/purchasing/purchase-invoices-table";
import { PurchaseReceiveDialog } from "@/components/purchasing/purchase-receive-dialog";
import { PurchaseTableSkeleton } from "@/components/purchasing/purchase-table-skeleton";
import { PurchasingToolbar } from "@/components/purchasing/purchasing-toolbar";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { PageHeader } from "@/components/shared/page-header";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useChartAccounts } from "@/hooks/use-accounting";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { usePermission } from "@/hooks/use-permission";
import {
  useCancelPurchaseInvoice,
  useConvertPurchaseInvoiceToReceipt,
  useCreatePurchaseInvoice,
  usePostPurchaseInvoice,
  usePurchaseInvoices,
  usePurchasingBranches,
  usePurchasingProducts,
  usePurchasingSuppliers,
  usePurchasingTaxRates,
  usePurchasingUnits,
  useReceivePurchase,
  useUpdatePurchaseInvoice,
} from "@/hooks/use-purchasing";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import { getPurchaseInvoiceUpdateErrorMessage } from "@/lib/api/purchase-invoice-conflicts";
import { getPurchaseInvoiceById } from "@/lib/api/purchasing";
import type {
  CreatePurchaseInvoicePayload,
  PurchaseInvoice,
  PurchasingFilters,
  ReceivePurchasePayload,
  UpdatePurchaseInvoicePayload,
} from "@/types/purchasing";

const defaultFilters: PurchasingFilters = {
  branchId: "",
  dateFrom: "",
  dateTo: "",
  paymentStatus: "all",
  search: "",
  status: "all",
  supplierId: "all",
};

const invoiceStatuses = [
  { label: "Draft", value: "draft" },
  { label: "Posted", value: "posted" },
  { label: "Cancelled", value: "cancelled" },
];

const paymentStatuses = [
  { label: "Unpaid", value: "unpaid" },
  { label: "Partial", value: "partial" },
  { label: "Paid", value: "paid" },
  { label: "Overdue", value: "overdue" },
];

type PendingAction = { invoice: PurchaseInvoice; type: "post" | "cancel" } | null;

export function PurchaseInvoicesPageClient(): JSX.Element {
  const router = useRouter();
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const { normalizeBranchId } = branchScope;
  const canView = hasAnyPermission([PERMISSIONS.purchasingView, PERMISSIONS.inventoryView]);
  const canManage = hasAnyPermission([
    PERMISSIONS.purchasingInvoicesCreate,
    PERMISSIONS.purchasingInvoicesEdit,
    PERMISSIONS.purchasingInvoicesPost,
    PERMISSIONS.purchasingInvoicesCancel,
    PERMISSIONS.purchasingReceiveStock,
  ]);
  const canConvertToReceipt = hasAnyPermission([
    PERMISSIONS.purchasingReceiptsCreate,
    PERMISSIONS.purchasingReceiveStock,
  ]);
  const [filters, setFilters] = useState<PurchasingFilters>({
    ...defaultFilters,
    branchId: branchScope.defaultBranchId,
  });
  const [editingInvoice, setEditingInvoice] = useState<PurchaseInvoice | null>(null);
  const [receivingInvoice, setReceivingInvoice] = useState<PurchaseInvoice | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [loadingInvoiceDetailId, setLoadingInvoiceDetailId] = useState<string | null>(null);
  const invoicesQuery = usePurchaseInvoices(filters, canView && branchScope.hasBranchScope);
  const suppliersQuery = usePurchasingSuppliers("", canView);
  const branchesQuery = usePurchasingBranches(canView);
  const productsQuery = usePurchasingProducts(canView);
  const unitsQuery = usePurchasingUnits(canView);
  const taxRatesQuery = usePurchasingTaxRates(canView);
  const purchaseAccountsQuery = useChartAccounts(
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
  const createMutation = useCreatePurchaseInvoice();
  const updateMutation = useUpdatePurchaseInvoice();
  const postMutation = usePostPurchaseInvoice();
  const cancelMutation = useCancelPurchaseInvoice();
  const receiveMutation = useReceivePurchase();
  const convertMutation = useConvertPurchaseInvoiceToReceipt();
  const isPermissionDenied =
    invoicesQuery.error instanceof ApiError && invoicesQuery.error.status === 403;

  const branchOptions = useMemo(
    () =>
      (branchesQuery.data ?? []).filter(
        (branch) => branchScope.canAccessAllBranches || branchScope.isBranchAllowed(branch.id),
      ),
    [branchScope, branchesQuery.data],
  );

  useEffect(() => {
    setFilters((currentFilters) => {
      const branchId = normalizeBranchId(currentFilters.branchId);
      return branchId === currentFilters.branchId
        ? currentFilters
        : { ...currentFilters, branchId };
    });
  }, [normalizeBranchId]);

  if (!canView) {
    return <AccessDeniedCard />;
  }

  if (!branchScope.hasBranchScope) {
    return <NoBranchScopeCard />;
  }

  const openCreate = (): void => {
    setEditingInvoice(null);
    setFormOpen(true);
  };

  const handleCreate = async (payload: CreatePurchaseInvoicePayload): Promise<void> => {
    try {
      await createMutation.mutateAsync(payload);
      toast.success("Bill created.");
      setFormOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleUpdate = async (id: string, payload: UpdatePurchaseInvoicePayload): Promise<void> => {
    try {
      await updateMutation.mutateAsync({ id, payload });
      toast.success("Bill updated.");
      setEditingInvoice(null);
      setFormOpen(false);
    } catch (error) {
      toast.error(getPurchaseInvoiceUpdateErrorMessage(error));
    }
  };

  const handleReceive = async (payload: ReceivePurchasePayload): Promise<void> => {
    try {
      await receiveMutation.mutateAsync(payload);
      toast.success("Stock received and inventory updated successfully.");
      setReceivingInvoice(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const loadInvoiceDetail = async (invoice: PurchaseInvoice): Promise<PurchaseInvoice> => {
    setLoadingInvoiceDetailId(invoice.id);
    try {
      return await getPurchaseInvoiceById(invoice.id);
    } finally {
      setLoadingInvoiceDetailId(null);
    }
  };

  const handleEditInvoice = async (invoice: PurchaseInvoice): Promise<void> => {
    try {
      const invoiceDetail = await loadInvoiceDetail(invoice);
      setEditingInvoice(invoiceDetail);
      setFormOpen(true);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleOpenReceive = async (invoice: PurchaseInvoice): Promise<void> => {
    try {
      const invoiceDetail = await loadInvoiceDetail(invoice);
      setReceivingInvoice(invoiceDetail);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleConvertToReceipt = async (invoice: PurchaseInvoice): Promise<void> => {
    try {
      const receipt = await convertMutation.mutateAsync({
        id: invoice.id,
        payload: {
          notes: `Created from ${invoice.invoiceNumber}`,
          receivedDate: new Date().toISOString().slice(0, 10),
        },
      });
      toast.success("Bill converted to draft receive goods record.");
      router.push(`${ROUTES.purchasingReceipts}/${receipt.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const confirmAction = async (): Promise<void> => {
    if (!pendingAction) return;

    try {
      if (pendingAction.type === "post") {
        await postMutation.mutateAsync(pendingAction.invoice.id);
        toast.success("Bill posted.");
      } else {
        const reason = cancelReason.trim();
        if (!reason) {
          toast.error("Enter a cancellation reason before cancelling the bill.");
          return;
        }
        await cancelMutation.mutateAsync({
          id: pendingAction.invoice.id,
          payload: { reason },
        });
        toast.success("Bill cancelled.");
      }
      setPendingAction(null);
      setCancelReason("");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const invoices = invoicesQuery.data ?? [];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Bills"
        description="Review supplier bills, posting status, and payable balances."
        actions={
          canManage ? (
            <Button onClick={openCreate} type="button">
              <Plus className="h-4 w-4" />
              Create Bill
            </Button>
          ) : undefined
        }
      />

      <PurchasingToolbar
        allowAllBranches={branchScope.canAccessAllBranches}
        branches={branchOptions}
        filters={filters}
        onFiltersChange={setFilters}
        paymentStatuses={paymentStatuses}
        resetBranchId={branchScope.defaultBranchId}
        statuses={invoiceStatuses}
        suppliers={suppliersQuery.data ?? []}
      />

      {invoicesQuery.isLoading ? <PurchaseTableSkeleton /> : null}

      {!invoicesQuery.isLoading && invoicesQuery.error ? (
        isPermissionDenied ? (
          <AccessDeniedCard message="The backend denied access to bills." />
        ) : (
          <PurchaseErrorState
            description={getErrorMessage(invoicesQuery.error)}
            onRetry={() => {
              void invoicesQuery.refetch();
            }}
          />
        )
      ) : null}

      {!invoicesQuery.isLoading && !invoicesQuery.error && invoices.length === 0 ? (
        <PurchaseEmptyState
          actionLabel={canManage ? "Create Bill" : undefined}
          onAction={canManage ? openCreate : undefined}
          title="No bills found."
        />
      ) : null}

      {!invoicesQuery.isLoading && !invoicesQuery.error && invoices.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <PurchaseInvoicesTable
              canConvertToReceipt={canConvertToReceipt}
              canManage={canManage}
              invoices={invoices}
              loadingInvoiceId={loadingInvoiceDetailId}
              onCancel={(invoice) => {
                setCancelReason("");
                setPendingAction({ invoice, type: "cancel" });
              }}
              onConvertToReceipt={(invoice) => void handleConvertToReceipt(invoice)}
              onEdit={(invoice) => void handleEditInvoice(invoice)}
              onPost={(invoice) => setPendingAction({ invoice, type: "post" })}
              onReceive={(invoice) => void handleOpenReceive(invoice)}
            />
          </CardContent>
        </Card>
      ) : null}

      <PurchaseInvoiceFormDialog
        accounts={[...(purchaseAccountsQuery.data?.items ?? [])]}
        branches={branchesQuery.data ?? []}
        invoice={editingInvoice}
        isSubmitting={
          createMutation.isPending || updateMutation.isPending || loadingInvoiceDetailId !== null
        }
        onClose={() => {
          setEditingInvoice(null);
          setFormOpen(false);
        }}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        open={formOpen}
        products={productsQuery.data ?? []}
        suppliers={suppliersQuery.data ?? []}
        taxRates={taxRatesQuery.data ?? []}
        units={unitsQuery.data ?? []}
      />

      <PurchaseReceiveDialog
        branches={branchesQuery.data ?? []}
        invoice={receivingInvoice}
        isSubmitting={receiveMutation.isPending || loadingInvoiceDetailId !== null}
        onClose={() => setReceivingInvoice(null)}
        onReceive={handleReceive}
        open={receivingInvoice !== null}
        products={productsQuery.data ?? []}
        suppliers={suppliersQuery.data ?? []}
        taxRates={taxRatesQuery.data ?? []}
        units={unitsQuery.data ?? []}
      />

      <Dialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAction(null);
            setCancelReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction?.type === "post" ? "Post bill" : "Cancel Bill"}
            </DialogTitle>
            <DialogDescription>
              {pendingAction?.type === "post"
                ? "Posting confirms the supplier bill and payable total."
                : "Cancelling this posted bill will reverse supplier payable, VAT, and inventory if the stock is still available. This action keeps an audit trail and cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          {pendingAction?.type === "cancel" ? (
            <div className="space-y-2">
              <Label htmlFor="bill-cancel-reason">Cancellation reason</Label>
              <Textarea
                id="bill-cancel-reason"
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="Wrong supplier bill entered"
                value={cancelReason}
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button
              onClick={() => {
                setPendingAction(null);
                setCancelReason("");
              }}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={
                postMutation.isPending ||
                cancelMutation.isPending ||
                (pendingAction?.type === "cancel" && !cancelReason.trim())
              }
              onClick={() => void confirmAction()}
              type="button"
            >
              {pendingAction?.type === "post" ? "Post bill" : "Cancel Bill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
