"use client";

import { Pencil } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";

import {
  PAYMENT_METHOD_MODULES,
  paymentMethodAccountState,
  PaymentMethodStatusBadge,
} from "@/components/settings/payment-methods-table";
import { type FormTab, FormTabs } from "@/components/shared/form-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatLabel } from "@/lib/format/label";
import type { PaymentMethod } from "@/types/settings";

type PaymentMethodDetailsDrawerProps = {
  canManage: boolean;
  method: PaymentMethod | null;
  /** Opens the edit form in the host's own modal flow. */
  onEdit?: ((method: PaymentMethod) => void) | undefined;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type PaymentMethodDetailTabKey = "details" | "visibility";

const TABPANEL_ID = "payment-method-detail-tabpanel";

function DetailRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="grid gap-0.5 rounded-lg bg-muted px-3 py-2">
      <span className="text-meta text-foreground-muted">{label}</span>
      <span className="break-words text-cell font-medium tabular-nums">{value}</span>
    </div>
  );
}

function formatDateTime(value: string): string {
  return value ? new Date(value).toLocaleString("en-AE") : "—";
}

/**
 * One payment method in a sheet over the list. The row already carries the
 * whole record, so the sheet needs no fetch of its own. Settings rows have no
 * page of their own; the tab strip is button-based for the same reason.
 */
export function PaymentMethodDetailsDrawer({
  canManage,
  method,
  onEdit,
  onOpenChange,
  open,
}: PaymentMethodDetailsDrawerProps): JSX.Element {
  const fallbackTitle = (
    <SheetHeader className="sr-only">
      <SheetTitle>Payment method details</SheetTitle>
      <SheetDescription>Details of the selected payment method.</SheetDescription>
    </SheetHeader>
  );

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        {method ? (
          <PaymentMethodDetailsDrawerBody
            canManage={canManage}
            key={method.id}
            method={method}
            onEdit={onEdit}
          />
        ) : (
          fallbackTitle
        )}
      </SheetContent>
    </Sheet>
  );
}

function PaymentMethodDetailsDrawerBody({
  canManage,
  method,
  onEdit,
}: {
  canManage: boolean;
  method: PaymentMethod;
  onEdit: ((method: PaymentMethod) => void) | undefined;
}): JSX.Element {
  const [activeTab, setActiveTab] = useState<PaymentMethodDetailTabKey>("details");
  const account = paymentMethodAccountState(method);
  const visibleCount = PAYMENT_METHOD_MODULES.filter((module) => method[module.key]).length;
  const tabs: FormTab<PaymentMethodDetailTabKey>[] = [
    { key: "details", label: "Details" },
    { key: "visibility", label: "Visibility", badge: visibleCount },
  ];

  return (
    <div className="flex flex-col gap-6">
      <SheetHeader>
        <div className="flex flex-wrap items-center gap-3 pr-8">
          <SheetTitle className="text-page">{method.methodName}</SheetTitle>
          <PaymentMethodStatusBadge status={method.status} />
        </div>
        <SheetDescription>
          {formatLabel(method.methodType)}
          {method.isDefault ? " · Default method" : ""}
        </SheetDescription>
        {canManage && onEdit ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={() => onEdit(method)} size="sm" type="button" variant="outline">
              <Pencil className="h-4 w-4" />
              Edit method
            </Button>
          </div>
        ) : null}
      </SheetHeader>

      <FormTabs
        active={activeTab}
        aria-label="Payment method sections"
        onTabChange={setActiveTab}
        panelId={TABPANEL_ID}
        tabs={tabs}
      />

      <div id={TABPANEL_ID} role="tabpanel" tabIndex={-1}>
        {activeTab === "details" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <div className="grid gap-0.5 rounded-lg bg-muted px-3 py-2">
                <span className="text-meta text-foreground-muted">Linked payment account</span>
                <span
                  className={
                    account.tone === "danger"
                      ? "text-cell font-medium text-danger-text"
                      : "text-cell font-medium"
                  }
                >
                  {account.label}
                </span>
              </div>
            </div>
            <DetailRow label="Type" value={formatLabel(method.methodType)} />
            <DetailRow label="Branch" value={method.branchName ?? "Business-wide"} />
            <DetailRow label="Default method" value={method.isDefault ? "Yes" : "No"} />
            <DetailRow
              label="Split payment"
              value={method.allowSplitPayment ? "Allowed" : "Not allowed"}
            />
            <DetailRow
              label="Transaction reference"
              value={method.requiresReference ? "Required" : "Optional"}
            />
            <DetailRow label="Status" value={formatLabel(method.status)} />
            <DetailRow label="Created" value={formatDateTime(method.createdAt)} />
            <DetailRow label="Updated" value={formatDateTime(method.updatedAt)} />
          </div>
        ) : null}

        {activeTab === "visibility" ? (
          <div className="grid gap-2">
            {PAYMENT_METHOD_MODULES.map((module) => (
              <div
                className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2"
                key={module.key}
              >
                <span className="text-cell">{module.label}</span>
                <Badge variant={method[module.key] ? "money" : "outline"}>
                  {method[module.key] ? "Shown" : "Hidden"}
                </Badge>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
