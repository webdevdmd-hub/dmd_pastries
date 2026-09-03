"use client";

import { Plus, ReceiptText, ShieldAlert } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useConfirm } from "@/components/app/confirm-provider";
import { ReceiptLayoutDetailsDrawer } from "@/components/settings/receipt-layout-details-drawer";
import {
  receiptFieldOptions,
  receiptTypeLabels,
} from "@/components/settings/receipt-layout-shared";
import { ReceiptLayoutsCardGrid } from "@/components/settings/receipt-layouts-card-grid";
import { ReceiptLayoutsTable } from "@/components/settings/receipt-layouts-table";
import {
  defaultReceiptLayoutFilters,
  type ReceiptLayoutFilters,
  ReceiptLayoutsToolbar,
} from "@/components/settings/receipt-layouts-toolbar";
import { EmptyState, FilteredState } from "@/components/shared/collection-state";
import { FormTabs } from "@/components/shared/form-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERMISSIONS } from "@/constants/permissions";
import { useBranches } from "@/hooks/use-branches";
import { usePermission } from "@/hooks/use-permission";
import {
  useCreateReceiptLayout,
  useDeleteReceiptLayout,
  usePreviewReceiptLayout,
  useReceiptLayouts,
  useSetDefaultReceiptLayout,
  useUpdateReceiptLayout,
} from "@/hooks/use-settings-data";
import { getErrorMessage } from "@/lib/api/client";
import {
  type ReceiptLayoutSchema,
  receiptLayoutSchema,
} from "@/lib/validators/receipt-layout.schema";
import type { ReceiptLayout, ReceiptLayoutConfig, ReceiptLayoutType } from "@/types/settings";

const businessWideBranchValue = "__business_wide__";

const defaultLayoutConfig: ReceiptLayoutConfig = {
  alignment: "center",
  fontSize: "medium",
  footerMessage: "Thank you for your purchase.",
  showAddress: true,
  showBranchName: true,
  showBusinessName: true,
  showCashier: true,
  showCustomer: true,
  showDiscount: true,
  showLogo: true,
  showPaymentMethod: true,
  showPhone: true,
  showQrCode: false,
  showTax: true,
  showTaxNumber: true,
  showUnitPrice: true,
  spacing: "normal",
  termsText: "",
};

function blankFormState(): ReceiptLayoutSchema {
  return {
    branchId: null,
    counterId: null,
    isDefault: true,
    layoutConfig: defaultLayoutConfig,
    layoutName: "",
    printerType: null,
    receiptType: "80mm",
    status: "active",
  };
}

function toFormState(layout: ReceiptLayout): ReceiptLayoutSchema {
  return {
    branchId: layout.branchId,
    counterId: layout.counterId,
    isDefault: layout.isDefault,
    layoutConfig: layout.layoutConfig,
    layoutName: layout.layoutName,
    printerType: layout.printerType,
    receiptType: layout.receiptType,
    status: layout.status,
  };
}

function ReceiptMockPreview({ layout }: { layout: ReceiptLayoutSchema }): JSX.Element {
  const textClass =
    layout.layoutConfig.fontSize === "small"
      ? "text-xs"
      : layout.layoutConfig.fontSize === "large"
        ? "text-base"
        : "text-sm";
  const spacingClass =
    layout.layoutConfig.spacing === "compact"
      ? "space-y-1"
      : layout.layoutConfig.spacing === "relaxed"
        ? "space-y-4"
        : "space-y-2";
  const alignClass = layout.layoutConfig.alignment === "center" ? "text-center" : "text-left";

  return (
    <div className="rounded-3xl border border-dashed border-brand-cappuccino bg-card p-5 shadow-sm">
      <div
        className={`mx-auto ${spacingClass} ${textClass} ${alignClass} text-brand-espresso ${
          layout.receiptType === "58mm"
            ? "max-w-52"
            : layout.receiptType === "80mm"
              ? "max-w-72"
              : "max-w-md"
        }`}
      >
        {layout.layoutConfig.showLogo ? (
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-cappuccino/50">
            <ReceiptText className="h-5 w-5" />
          </div>
        ) : null}
        {layout.layoutConfig.showBusinessName ? (
          <p className="font-bold">Golden Crust Bakery</p>
        ) : null}
        {layout.layoutConfig.showBranchName ? <p>Main Branch</p> : null}
        {layout.layoutConfig.showAddress ? <p>Business address line</p> : null}
        {layout.layoutConfig.showPhone ? <p>+971 50 000 0000</p> : null}
        {layout.layoutConfig.showTaxNumber ? <p>TRN: 100000000000003</p> : null}
        <div className="border-y border-brand-cappuccino py-2">
          <p>Receipt #POS-000124</p>
          <p>12 May 2026, 05:45 PM</p>
          {layout.layoutConfig.showCashier ? <p>Cashier: Mina</p> : null}
          {layout.layoutConfig.showCustomer ? <p>Customer: Walk-in</p> : null}
        </div>
        <div className="space-y-1 text-left">
          <div className="flex justify-between gap-3">
            <span>2 x Black Forest Cake</span>
            <strong>AED 240.00</strong>
          </div>
          {layout.layoutConfig.showUnitPrice ? (
            <p className="text-brand-mocha">Unit: AED 120.00</p>
          ) : null}
        </div>
        <div className="border-t border-brand-cappuccino pt-2">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>AED 240.00</span>
          </div>
          {layout.layoutConfig.showDiscount ? (
            <div className="flex justify-between">
              <span>Discount</span>
              <span>AED 0.00</span>
            </div>
          ) : null}
          {layout.layoutConfig.showTax ? (
            <div className="flex justify-between">
              <span>Tax</span>
              <span>AED 12.00</span>
            </div>
          ) : null}
          <div className="flex justify-between text-body font-medium">
            <span>Total</span>
            <span>AED 252.00</span>
          </div>
          {layout.layoutConfig.showPaymentMethod ? <p>Paid by: Cash</p> : null}
        </div>
        {layout.layoutConfig.showQrCode ? (
          <div className="mx-auto h-14 w-14 rounded-lg bg-brand-espresso/15" />
        ) : null}
        {layout.layoutConfig.footerMessage ? <p>{layout.layoutConfig.footerMessage}</p> : null}
        {layout.layoutConfig.termsText ? (
          <p className="text-xs text-brand-mocha">{layout.layoutConfig.termsText}</p>
        ) : null}
      </div>
    </div>
  );
}

type ReceiptLayoutDialogProps = {
  layout: ReceiptLayout | null;
  open: boolean;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ReceiptLayoutSchema) => Promise<void>;
};

type ReceiptFormTabKey = "layout" | "fields" | "style";

const RECEIPT_FORM_TABPANEL_ID = "receipt-layout-form-tabpanel";

function ReceiptLayoutDialog({
  layout,
  open,
  submitting,
  onOpenChange,
  onSubmit,
}: ReceiptLayoutDialogProps): JSX.Element {
  const branchesQuery = useBranches(open);
  const activeBranches = useMemo(
    () => (branchesQuery.data ?? []).filter((branch) => branch.status === "active"),
    [branchesQuery.data],
  );
  const [formState, setFormState] = useState<ReceiptLayoutSchema>(
    layout ? toFormState(layout) : blankFormState(),
  );
  const [activeTab, setActiveTab] = useState<ReceiptFormTabKey>("layout");
  const shownFieldCount = receiptFieldOptions.filter(
    (option) => formState.layoutConfig[option.key],
  ).length;

  useEffect(() => {
    if (open) {
      setFormState(layout ? toFormState(layout) : blankFormState());
    }
  }, [layout, open]);

  const updateConfig = <TKey extends keyof ReceiptLayoutConfig>(
    key: TKey,
    value: ReceiptLayoutConfig[TKey],
  ): void => {
    setFormState((current) => ({
      ...current,
      layoutConfig: {
        ...current.layoutConfig,
        [key]: value,
      },
    }));
  };

  const handleSubmit = async (): Promise<void> => {
    const parsed = receiptLayoutSchema.safeParse(formState);

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Receipt layout form is invalid.");
      return;
    }

    await onSubmit(parsed.data);
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{layout ? "Edit receipt layout" : "Create receipt layout"}</DialogTitle>
          <DialogDescription>
            Configure the printable receipt template used by POS billing machines.
          </DialogDescription>
        </DialogHeader>

        {/* Three tabs on one form state. Twelve fields, thirteen toggles and
            five style controls in one column meant the style settings sat
            below the fold of the toggles, which sat below the fold of the
            scope fields. The live preview stays beside all three. */}
        <div className="min-w-0 pb-4">
          <FormTabs
            active={activeTab}
            aria-label="Receipt layout sections"
            onTabChange={setActiveTab}
            panelId={RECEIPT_FORM_TABPANEL_ID}
            tabs={[
              { key: "layout", label: "Layout" },
              { key: "fields", label: "Fields", badge: shownFieldCount },
              { key: "style", label: "Style" },
            ]}
          />
        </div>

        <div
          className="grid min-w-0 gap-6 lg:grid-cols-[1fr_22rem]"
          id={RECEIPT_FORM_TABPANEL_ID}
          role="tabpanel"
        >
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <div className={activeTab === "layout" ? "contents" : "hidden"}>
              <div className="grid gap-2">
                <Label htmlFor="layoutName">Layout name</Label>
                <Input
                  id="layoutName"
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, layoutName: event.target.value }))
                  }
                  value={formState.layoutName}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="receipt-layouts-receipt-type">Receipt type</Label>
                <Select
                  onValueChange={(value) =>
                    setFormState((current) => ({
                      ...current,
                      receiptType: value as ReceiptLayoutType,
                    }))
                  }
                  value={formState.receiptType}
                >
                  <SelectTrigger id="receipt-layouts-receipt-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(receiptTypeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="receipt-layouts-branch-scope">Branch scope</Label>
                <Select
                  onValueChange={(value) =>
                    setFormState((current) => ({
                      ...current,
                      branchId: value === businessWideBranchValue ? null : value,
                      isDefault:
                        layout === null ? value === businessWideBranchValue : current.isDefault,
                    }))
                  }
                  value={formState.branchId ?? businessWideBranchValue}
                >
                  <SelectTrigger id="receipt-layouts-branch-scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={businessWideBranchValue}>Business-wide default</SelectItem>
                    {activeBranches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="receipt-layouts-status">Status</Label>
                <Select
                  onValueChange={(value) =>
                    setFormState((current) => ({
                      ...current,
                      isDefault: value === "inactive" ? false : current.isDefault,
                      status: value === "inactive" ? "inactive" : "active",
                    }))
                  }
                  value={formState.status}
                >
                  <SelectTrigger id="receipt-layouts-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="printerType">Printer type</Label>
                <Input
                  id="printerType"
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      printerType: event.target.value.trim() || null,
                    }))
                  }
                  placeholder="Thermal, Epson, Sunmi..."
                  value={formState.printerType ?? ""}
                />
              </div>
              <label className="flex items-center gap-3 rounded-2xl border border-brand-cappuccino bg-brand-latte/60 p-3 text-sm font-medium text-brand-espresso">
                <Checkbox
                  checked={formState.isDefault}
                  disabled={formState.status === "inactive"}
                  onCheckedChange={(checked) => {
                    setFormState((current) => ({
                      ...current,
                      isDefault: checked === true,
                    }));
                  }}
                />
                Set as default for this scope
              </label>
              <div className="grid gap-2">
                <Label htmlFor="counterId">Counter ID</Label>
                <Input
                  id="counterId"
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      counterId: event.target.value.trim() || null,
                    }))
                  }
                  placeholder="Counter 1"
                  value={formState.counterId ?? ""}
                />
              </div>
            </div>

            <div className={activeTab === "fields" ? "contents" : "hidden"}>
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Visible receipt fields</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {receiptFieldOptions.map((option) => (
                    <label
                      className="flex items-center gap-3 rounded-2xl border border-brand-cappuccino bg-brand-latte/60 p-3 text-sm font-medium text-brand-espresso"
                      key={option.key}
                    >
                      <Checkbox
                        checked={formState.layoutConfig[option.key]}
                        onCheckedChange={(checked) => {
                          updateConfig(option.key, checked === true);
                        }}
                      />
                      {option.label}
                    </label>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className={activeTab === "style" ? "contents" : "hidden"}>
              <div className="grid gap-2">
                <Label htmlFor="receipt-layouts-font-size">Font size</Label>
                <Select
                  onValueChange={(value) =>
                    updateConfig(
                      "fontSize",
                      value === "small" || value === "large" ? value : "medium",
                    )
                  }
                  value={formState.layoutConfig.fontSize}
                >
                  <SelectTrigger id="receipt-layouts-font-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="receipt-layouts-alignment">Alignment</Label>
                <Select
                  onValueChange={(value) =>
                    updateConfig("alignment", value === "left" ? "left" : "center")
                  }
                  value={formState.layoutConfig.alignment}
                >
                  <SelectTrigger id="receipt-layouts-alignment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="left">Left</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="receipt-layouts-spacing">Spacing</Label>
                <Select
                  onValueChange={(value) =>
                    updateConfig(
                      "spacing",
                      value === "compact" || value === "relaxed" ? value : "normal",
                    )
                  }
                  value={formState.layoutConfig.spacing}
                >
                  <SelectTrigger id="receipt-layouts-spacing">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compact">Compact</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="relaxed">Relaxed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="footerMessage">Footer message</Label>
                <Input
                  id="footerMessage"
                  onChange={(event) => updateConfig("footerMessage", event.target.value)}
                  value={formState.layoutConfig.footerMessage}
                />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="termsText">Terms and conditions</Label>
                <textarea
                  className="min-h-24 rounded-xl border border-brand-cappuccino bg-brand-latte px-3 py-2 text-sm text-brand-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-caramel"
                  id="termsText"
                  onChange={(event) => updateConfig("termsText", event.target.value)}
                  value={formState.layoutConfig.termsText}
                />
              </div>
            </div>
          </div>

          <div className="grid min-w-0 gap-3">
            <p className="text-meta text-foreground-muted">Live preview</p>
            <ReceiptMockPreview layout={formState} />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={submitting} onClick={() => void handleSubmit()} type="button">
            {submitting ? "Saving..." : layout ? "Save changes" : "Create layout"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LayoutPreviewDialog({
  layout,
  onOpenChange,
  open,
  previewHtml,
  previewText,
}: {
  layout: ReceiptLayout | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  previewHtml: string | null;
  previewText: string | null;
}): JSX.Element {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Receipt preview</DialogTitle>
          <DialogDescription>
            Backend-rendered preview for {layout?.layoutName ?? "the selected layout"}.
          </DialogDescription>
        </DialogHeader>
        {previewHtml ? (
          <iframe
            className="h-[32rem] w-full rounded-2xl border border-brand-cappuccino bg-card"
            sandbox=""
            srcDoc={previewHtml}
            title="Receipt layout preview"
          />
        ) : (
          <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-2xl border border-brand-cappuccino bg-card p-4 text-sm text-brand-espresso">
            {previewText ?? "The backend did not return preview content for this layout."}
          </pre>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ReceiptLayoutsPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.settingsView, PERMISSIONS.settingsReceiptUpdate]);
  const canManage = hasAnyPermission([PERMISSIONS.settingsReceiptUpdate]);
  const layoutsQuery = useReceiptLayouts(canView);
  const createMutation = useCreateReceiptLayout();
  const updateMutation = useUpdateReceiptLayout();
  const deleteMutation = useDeleteReceiptLayout();
  const defaultMutation = useSetDefaultReceiptLayout();
  const previewMutation = usePreviewReceiptLayout();

  const [editingLayout, setEditingLayout] = useState<ReceiptLayout | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewLayout, setPreviewLayout] = useState<ReceiptLayout | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [drawerLayout, setDrawerLayout] = useState<ReceiptLayout | null>(null);
  const [filters, setFilters] = useState<ReceiptLayoutFilters>(defaultReceiptLayoutFilters);
  const confirm = useConfirm();

  const layouts = layoutsQuery.data ?? [];
  const submitting = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (values: ReceiptLayoutSchema): Promise<void> => {
    try {
      if (editingLayout) {
        await updateMutation.mutateAsync({ id: editingLayout.id, payload: values });
        toast.success("Receipt layout updated.");
      } else {
        await createMutation.mutateAsync(values);
        toast.success("Receipt layout created.");
      }

      setDialogOpen(false);
      setEditingLayout(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handlePreview = async (layout: ReceiptLayout): Promise<void> => {
    setDrawerLayout(null);
    setPreviewLayout(layout);
    try {
      await previewMutation.mutateAsync(layout.id);
      setPreviewOpen(true);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const openEdit = (layout: ReceiptLayout): void => {
    setDrawerLayout(null);
    setEditingLayout(layout);
    setDialogOpen(true);
  };

  const handleSetDefault = async (layout: ReceiptLayout): Promise<void> => {
    setDrawerLayout(null);

    try {
      await defaultMutation.mutateAsync(layout.id);
      toast.success("Default receipt layout updated.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleDelete = async (layout: ReceiptLayout): Promise<void> => {
    setDrawerLayout(null);

    // There was no confirmation at all: one click on a menu item deleted the
    // template every printed receipt for that scope is produced from.
    const confirmed = await confirm({
      cancelLabel: "Keep layout",
      confirmLabel: "Delete layout",
      consequence: `This permanently deletes ${layout.layoutName}. It cannot be undone.`,
      detail: layout.isDefault
        ? "It is the default for its scope, so receipts there fall back to the business-wide layout."
        : "Receipts using it fall back to the default layout for their scope.",
      title: "Delete this receipt layout?",
    });

    if (!confirmed) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(layout.id);
      toast.success("Receipt layout deleted.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const query = filters.search.trim().toLowerCase();
  const visibleLayouts = layouts.filter((layout) => {
    const matchesQuery =
      query.length === 0 ||
      layout.layoutName.toLowerCase().includes(query) ||
      (layout.printerType ?? "").toLowerCase().includes(query) ||
      (layout.counterId ?? "").toLowerCase().includes(query);
    const matchesStatus = filters.status === "all" || layout.status === filters.status;
    const matchesType = filters.receiptType === "all" || layout.receiptType === filters.receiptType;
    const matchesScope =
      filters.scope === "all" ||
      (filters.scope === "business" ? layout.branchId === null : layout.branchId !== null);

    return matchesQuery && matchesStatus && matchesType && matchesScope;
  });
  const hasActiveFilters =
    query.length > 0 ||
    filters.status !== "all" ||
    filters.receiptType !== "all" ||
    filters.scope !== "all";

  const listHandlers = {
    canManage,
    layouts: visibleLayouts,
    onDelete: (layout: ReceiptLayout) => {
      void handleDelete(layout);
    },
    onEdit: openEdit,
    onPreview: (layout: ReceiptLayout) => {
      void handlePreview(layout);
    },
    onSetDefault: (layout: ReceiptLayout) => {
      void handleSetDefault(layout);
    },
    onView: setDrawerLayout,
  };

  if (!canView) {
    return (
      <Alert className="border-danger/30 bg-danger-tint text-danger-text">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Access denied</AlertTitle>
        <AlertDescription>You need settings.view to view receipt layouts.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          canManage ? (
            <Button
              onClick={() => {
                setEditingLayout(null);
                setDialogOpen(true);
              }}
              type="button"
            >
              <Plus className="h-4 w-4" />
              Create layout
            </Button>
          ) : null
        }
        description="Create, preview, and assign POS receipt templates for branches, printers, and counters."
        title="Receipt Layouts"
      />

      {/* Two counts, not three. The third card was a KPI whose value was the
          hardcoded string "58 / 80 / A4" -- a static list of supported sizes
          dressed as a measured figure. */}
      <div className="flex min-w-0 gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:pb-0">
        <Card className="w-36 shrink-0 sm:w-auto sm:min-w-0">
          <CardContent className="p-4">
            <p className="text-meta text-foreground-muted">Layouts</p>
            <p className="mt-1 text-section font-medium tabular-nums">
              {layoutsQuery.isLoading ? "—" : layouts.length}
            </p>
            <p className="mt-0.5 text-meta text-foreground-muted">Configured templates</p>
          </CardContent>
        </Card>
        <Card className="w-36 shrink-0 sm:w-auto sm:min-w-0">
          <CardContent className="p-4">
            <p className="text-meta text-foreground-muted">Defaults set</p>
            <p className="mt-1 text-section font-medium tabular-nums">
              {layoutsQuery.isLoading ? "—" : layouts.filter((layout) => layout.isDefault).length}
            </p>
            <p className="mt-0.5 text-meta text-foreground-muted">One per scope</p>
          </CardContent>
        </Card>
      </div>

      {layoutsQuery.isLoading ? (
        <Card>
          <CardContent className="p-6">
            <div className="h-48 animate-pulse rounded-3xl bg-brand-cappuccino/30" />
          </CardContent>
        </Card>
      ) : null}

      {!layoutsQuery.isLoading && layoutsQuery.error ? (
        <Alert className="border-danger/30 bg-danger-tint text-danger-text">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Unable to load receipt layouts</AlertTitle>
          <AlertDescription>{getErrorMessage(layoutsQuery.error)}</AlertDescription>
        </Alert>
      ) : null}

      {!layoutsQuery.isLoading && !layoutsQuery.error && layouts.length === 0 ? (
        <EmptyState
          description="A layout decides what a printed receipt looks like â 80mm thermal, 58mm counter, A4 invoice, or a custom format."
          icon={ReceiptText}
          title="No receipt layouts yet"
        />
      ) : null}

      {!layoutsQuery.isLoading && !layoutsQuery.error && layouts.length > 0 ? (
        <ReceiptLayoutsToolbar filters={filters} onFiltersChange={setFilters} />
      ) : null}

      {!layoutsQuery.isLoading &&
      !layoutsQuery.error &&
      layouts.length > 0 &&
      visibleLayouts.length === 0 &&
      hasActiveFilters ? (
        <FilteredState
          noun="receipt layouts"
          onClearFilters={() => setFilters(defaultReceiptLayoutFilters)}
          query={filters.search.trim() || undefined}
        />
      ) : null}

      {visibleLayouts.length > 0 ? (
        <>
          <div className="md:hidden">
            <ReceiptLayoutsCardGrid {...listHandlers} />
          </div>
          <Card className="hidden overflow-hidden md:block">
            <CardContent className="p-0">
              <ReceiptLayoutsTable {...listHandlers} />
            </CardContent>
          </Card>
        </>
      ) : null}

      <ReceiptLayoutDetailsDrawer
        canManage={canManage}
        layout={drawerLayout}
        onEdit={openEdit}
        onOpenChange={(open) => (!open ? setDrawerLayout(null) : undefined)}
        onPreview={(target) => {
          void handlePreview(target);
        }}
        onSetDefault={(target) => {
          void handleSetDefault(target);
        }}
        open={drawerLayout !== null}
      />

      <ReceiptLayoutDialog
        layout={editingLayout}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingLayout(null);
          }
        }}
        onSubmit={handleSubmit}
        open={dialogOpen}
        submitting={submitting}
      />
      <LayoutPreviewDialog
        layout={previewLayout}
        onOpenChange={setPreviewOpen}
        open={previewOpen}
        previewHtml={previewMutation.data?.previewHtml ?? null}
        previewText={previewMutation.data?.previewText ?? null}
      />
    </div>
  );
}
