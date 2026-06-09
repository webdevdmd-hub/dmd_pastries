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
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
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
  const [loadingInvoiceDetailId, setLoadingInvoiceDetailId] = useState<string | null>(null);
  const invoicesQuery = usePurchaseInvoices(filters, canView && branchScope.hasBranchScope);
  const suppliersQuery = usePurchasingSuppliers("", canView);
  const branchesQuery = usePurchasingBranches(canView);
  const productsQuery = usePurchasingProducts(canView);
  const unitsQuery = usePurchasingUnits(canView);
  const taxRatesQuery = usePurchasingTaxRates(canView);
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
      toast.success("Purchase invoice created.");
      setFormOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleUpdate = async (id: string, payload: UpdatePurchaseInvoicePayload): Promise<void> => {
    try {
      await updateMutation.mutateAsync({ id, payload });
      toast.success("Purchase invoice updated.");
      setEditingInvoice(null);
      setFormOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
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
      toast.success("Purchase invoice converted to draft receipt.");
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
        toast.success("Purchase invoice posted.");
      } else {
        await cancelMutation.mutateAsync(pendingAction.invoice.id);
        toast.success("Purchase invoice cancelled.");
      }
      setPendingAction(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const invoices = invoicesQuery.data ?? [];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Purchase Invoices"
        description="Record supplier invoices, posting status, and payable balances."
        actions={
          canManage ? (
            <Button onClick={openCreate} type="button">
              <Plus className="h-4 w-4" />
              Create Invoice
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
          <AccessDeniedCard message="The backend denied access to purchase invoices." />
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
          actionLabel={canManage ? "Create Invoice" : undefined}
          onAction={canManage ? openCreate : undefined}
          title="No purchase invoices found."
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
              onCancel={(invoice) => setPendingAction({ invoice, type: "cancel" })}
              onConvertToReceipt={(invoice) => void handleConvertToReceipt(invoice)}
              onEdit={(invoice) => void handleEditInvoice(invoice)}
              onPost={(invoice) => setPendingAction({ invoice, type: "post" })}
              onReceive={(invoice) => void handleOpenReceive(invoice)}
            />
          </CardContent>
        </Card>
      ) : null}

      <PurchaseInvoiceFormDialog
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
        onOpenChange={(open) => (!open ? setPendingAction(null) : undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction?.type === "post" ? "Post invoice" : "Cancel invoice"}
            </DialogTitle>
            <DialogDescription>
              {pendingAction?.type === "post"
                ? "Posting confirms the supplier invoice and payable total."
                : "Cancelling this invoice depends on backend purchasing rules."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setPendingAction(null)} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              disabled={postMutation.isPending || cancelMutation.isPending}
              onClick={() => void confirmAction()}
              type="button"
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
