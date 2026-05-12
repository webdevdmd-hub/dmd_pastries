"use client";

import {
  CheckCircle2,
  Eye,
  FileText,
  MoreHorizontal,
  Plus,
  ReceiptText,
  ShieldAlert,
  Star,
  Trash2,
} from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

const receiptTypeLabels: Record<ReceiptLayoutType, string> = {
  "58mm": "58mm thermal",
  "80mm": "80mm thermal",
  a4: "A4 invoice",
  custom: "Custom size",
};

const configOptions: {
  key: keyof Pick<
    ReceiptLayoutConfig,
    | "showAddress"
    | "showBranchName"
    | "showBusinessName"
    | "showCashier"
    | "showCustomer"
    | "showDiscount"
    | "showLogo"
    | "showPaymentMethod"
    | "showPhone"
    | "showQrCode"
    | "showTax"
    | "showTaxNumber"
    | "showUnitPrice"
  >;
  label: string;
}[] = [
  { key: "showLogo", label: "Logo" },
  { key: "showBusinessName", label: "Business name" },
  { key: "showBranchName", label: "Branch name" },
  { key: "showAddress", label: "Address" },
  { key: "showPhone", label: "Phone" },
  { key: "showTaxNumber", label: "Tax/VAT number" },
  { key: "showCashier", label: "Cashier name" },
  { key: "showCustomer", label: "Customer details" },
  { key: "showUnitPrice", label: "Unit price" },
  { key: "showDiscount", label: "Discount" },
  { key: "showTax", label: "Tax" },
  { key: "showPaymentMethod", label: "Payment method" },
  { key: "showQrCode", label: "QR code / barcode" },
];

function blankFormState(): ReceiptLayoutSchema {
  return {
    branchId: null,
    counterId: null,
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
    layoutConfig: layout.layoutConfig,
    layoutName: layout.layoutName,
    printerType: layout.printerType,
    receiptType: layout.receiptType,
    status: layout.status,
  };
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-AE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function ReceiptLayoutStatusBadge({ layout }: { layout: ReceiptLayout }): JSX.Element {
  if (layout.isDefault) {
    return (
      <Badge className="gap-1" variant="secondary">
        <Star className="h-3 w-3" />
        Default
      </Badge>
    );
  }

  return (
    <Badge variant={layout.status === "active" ? "secondary" : "default"}>{layout.status}</Badge>
  );
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
    <div className="rounded-3xl border border-dashed border-brand-cappuccino bg-white p-5 shadow-sm">
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
          <div className="flex justify-between text-base font-black">
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

        <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="grid gap-4 md:grid-cols-2">
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
              <Label>Receipt type</Label>
              <Select
                onValueChange={(value) =>
                  setFormState((current) => ({
                    ...current,
                    receiptType: value as ReceiptLayoutType,
                  }))
                }
                value={formState.receiptType}
              >
                <SelectTrigger>
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
              <Label>Branch scope</Label>
              <Select
                onValueChange={(value) =>
                  setFormState((current) => ({
                    ...current,
                    branchId: value === businessWideBranchValue ? null : value,
                  }))
                }
                value={formState.branchId ?? businessWideBranchValue}
              >
                <SelectTrigger>
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
              <Label>Status</Label>
              <Select
                onValueChange={(value) =>
                  setFormState((current) => ({
                    ...current,
                    status: value === "inactive" ? "inactive" : "active",
                  }))
                }
                value={formState.status}
              >
                <SelectTrigger>
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

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Visible receipt fields</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {configOptions.map((option) => (
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

            <div className="grid gap-2">
              <Label>Font size</Label>
              <Select
                onValueChange={(value) =>
                  updateConfig(
                    "fontSize",
                    value === "small" || value === "large" ? value : "medium",
                  )
                }
                value={formState.layoutConfig.fontSize}
              >
                <SelectTrigger>
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
              <Label>Alignment</Label>
              <Select
                onValueChange={(value) =>
                  updateConfig("alignment", value === "left" ? "left" : "center")
                }
                value={formState.layoutConfig.alignment}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="left">Left</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Spacing</Label>
              <Select
                onValueChange={(value) =>
                  updateConfig(
                    "spacing",
                    value === "compact" || value === "relaxed" ? value : "normal",
                  )
                }
                value={formState.layoutConfig.spacing}
              >
                <SelectTrigger>
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

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.18em] text-brand-mocha">Live preview</p>
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
            className="h-[32rem] w-full rounded-2xl border border-brand-cappuccino bg-white"
            sandbox=""
            srcDoc={previewHtml}
            title="Receipt layout preview"
          />
        ) : (
          <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-2xl border border-brand-cappuccino bg-white p-4 text-sm text-brand-espresso">
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
    setPreviewLayout(layout);
    try {
      await previewMutation.mutateAsync(layout.id);
      setPreviewOpen(true);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  if (!canView) {
    return (
      <Alert className="border-red-200 bg-red-50 text-red-950">
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

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <ReceiptText className="h-5 w-5 text-brand-caramel" />
            <p className="mt-3 text-xs uppercase tracking-[0.18em] text-brand-mocha">Layouts</p>
            <p className="font-display text-3xl text-brand-espresso">{layouts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <Star className="h-5 w-5 text-brand-caramel" />
            <p className="mt-3 text-xs uppercase tracking-[0.18em] text-brand-mocha">Defaults</p>
            <p className="font-display text-3xl text-brand-espresso">
              {layouts.filter((layout) => layout.isDefault).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <FileText className="h-5 w-5 text-brand-caramel" />
            <p className="mt-3 text-xs uppercase tracking-[0.18em] text-brand-mocha">Supported</p>
            <p className="font-display text-3xl text-brand-espresso">58 / 80 / A4</p>
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
        <Alert className="border-red-200 bg-red-50 text-red-950">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Unable to load receipt layouts</AlertTitle>
          <AlertDescription>{getErrorMessage(layoutsQuery.error)}</AlertDescription>
        </Alert>
      ) : null}

      {!layoutsQuery.isLoading && !layoutsQuery.error && layouts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-10 text-center">
            <ReceiptText className="h-10 w-10 text-brand-caramel" />
            <h2 className="mt-4 text-2xl font-bold text-brand-espresso">No receipt layouts yet</h2>
            <p className="mt-2 max-w-xl text-brand-mocha">
              Create a default layout for 80mm thermal printers, 58mm counters, A4 invoice style, or
              a custom receipt format.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {!layoutsQuery.isLoading && !layoutsQuery.error && layouts.length > 0 ? (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Layout</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Receipt Type</TableHead>
                  <TableHead>Printer / Counter</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {layouts.map((layout) => (
                  <TableRow key={layout.id}>
                    <TableCell>
                      <div className="font-semibold text-brand-espresso">{layout.layoutName}</div>
                      {layout.isDefault ? (
                        <p className="flex items-center gap-1 text-xs text-brand-mocha">
                          <CheckCircle2 className="h-3 w-3" />
                          Default for this scope
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>{layout.branchName ?? "Business-wide"}</TableCell>
                    <TableCell>{receiptTypeLabels[layout.receiptType]}</TableCell>
                    <TableCell>
                      <div>{layout.printerType ?? "Any printer"}</div>
                      <p className="text-xs text-brand-mocha">
                        {layout.counterId ?? "Any counter"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <ReceiptLayoutStatusBadge layout={layout} />
                    </TableCell>
                    <TableCell>{formatDate(layout.updatedAt)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            aria-label={`Open actions for ${layout.layoutName}`}
                            size="icon"
                            type="button"
                            variant="ghost"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => void handlePreview(layout)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Preview
                          </DropdownMenuItem>
                          {canManage ? (
                            <>
                              <DropdownMenuItem
                                onSelect={() => {
                                  setEditingLayout(layout);
                                  setDialogOpen(true);
                                }}
                              >
                                Edit layout
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={layout.isDefault || defaultMutation.isPending}
                                onSelect={() => {
                                  defaultMutation
                                    .mutateAsync(layout.id)
                                    .then(() => toast.success("Default receipt layout updated."))
                                    .catch((error: unknown) => toast.error(getErrorMessage(error)));
                                }}
                              >
                                Set as default
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-700"
                                disabled={deleteMutation.isPending}
                                onSelect={() => {
                                  deleteMutation
                                    .mutateAsync(layout.id)
                                    .then(() => toast.success("Receipt layout deleted."))
                                    .catch((error: unknown) => toast.error(getErrorMessage(error)));
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
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
          </CardContent>
        </Card>
      ) : null}

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
