"use client";

import { Eye, Pencil, Star } from "lucide-react";
import type { JSX, ReactNode } from "react";
import { useState } from "react";

import {
  formatReceiptDate,
  receiptFieldOptions,
  ReceiptLayoutStatusBadge,
  receiptScopeLabel,
  receiptTypeLabels,
} from "@/components/settings/receipt-layout-shared";
import { FormTabs } from "@/components/shared/form-tabs";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { ReceiptLayout } from "@/types/settings";

const RECEIPT_DRAWER_TABPANEL_ID = "receipt-layout-drawer-tabpanel";

type ReceiptDrawerTabKey = "overview" | "content";

function InfoField({ label, value }: { label: string; value: ReactNode }): JSX.Element {
  return (
    <div className="min-w-0">
      <p className="text-meta text-foreground-muted">{label}</p>
      <div className="mt-0.5 break-words text-cell font-medium">{value}</div>
    </div>
  );
}

type ReceiptLayoutDetailsDrawerProps = {
  canManage: boolean;
  layout: ReceiptLayout | null;
  /** Each closes the drawer first, then opens the host's dialog. */
  onEdit: (layout: ReceiptLayout) => void;
  onOpenChange: (open: boolean) => void;
  onPreview: (layout: ReceiptLayout) => void;
  onSetDefault: (layout: ReceiptLayout) => void;
  open: boolean;
};

/**
 * One layout, over the list.
 *
 * Two tabs, because a layout genuinely has two halves: where it applies, and
 * what it prints. Reading which of the thirteen receipt fields a layout shows
 * used to mean opening its editor and counting checkboxes.
 */
export function ReceiptLayoutDetailsDrawer({
  canManage,
  layout,
  onEdit,
  onOpenChange,
  onPreview,
  onSetDefault,
  open,
}: ReceiptLayoutDetailsDrawerProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<ReceiptDrawerTabKey>("overview");

  const shown = layout
    ? receiptFieldOptions.filter((option) => layout.layoutConfig[option.key])
    : [];
  const hidden = layout
    ? receiptFieldOptions.filter((option) => !layout.layoutConfig[option.key])
    : [];

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl" side="right">
        {layout ? (
          <div className="grid min-w-0 gap-6" key={layout.id}>
            <SheetHeader className="space-y-0 p-0">
              <SheetTitle className="text-section">{layout.layoutName}</SheetTitle>
              <SheetDescription className="sr-only">
                Receipt layout scope and printed content.
              </SheetDescription>
              <p className="mt-1 text-meta text-foreground-muted">
                {receiptTypeLabels[layout.receiptType]} · {receiptScopeLabel(layout)}
              </p>
              <div className="mt-2">
                <ReceiptLayoutStatusBadge layout={layout} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => onPreview(layout)} size="sm" type="button" variant="outline">
                  <Eye className="h-4 w-4" />
                  Print preview
                </Button>
                {canManage ? (
                  <Button onClick={() => onEdit(layout)} size="sm" type="button" variant="outline">
                    <Pencil className="h-4 w-4" />
                    Edit layout
                  </Button>
                ) : null}
                {canManage && !layout.isDefault ? (
                  <Button
                    onClick={() => onSetDefault(layout)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Star className="h-4 w-4" />
                    Set as default
                  </Button>
                ) : null}
              </div>
            </SheetHeader>

            <FormTabs
              active={activeTab}
              aria-label="Receipt layout sections"
              onTabChange={setActiveTab}
              panelId={RECEIPT_DRAWER_TABPANEL_ID}
              tabs={[
                { key: "overview", label: "Overview" },
                { key: "content", label: "Printed content", badge: shown.length },
              ]}
            />

            <div className="min-w-0" id={RECEIPT_DRAWER_TABPANEL_ID} role="tabpanel" tabIndex={-1}>
              {activeTab === "overview" ? (
                <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
                  <InfoField label="Receipt type" value={receiptTypeLabels[layout.receiptType]} />
                  <InfoField label="Applies to" value={receiptScopeLabel(layout)} />
                  <InfoField label="Printer" value={layout.printerType ?? "Any printer"} />
                  <InfoField label="Counter" value={layout.counterId ?? "Any counter"} />
                  <InfoField
                    label="Updated"
                    value={
                      <span className="tabular-nums">{formatReceiptDate(layout.updatedAt)}</span>
                    }
                  />
                </div>
              ) : null}

              {activeTab === "content" ? (
                <div className="grid gap-4">
                  {/* Shown and hidden as two lists, so "does this receipt
                      print the VAT number" is one glance rather than a hunt
                      through thirteen checkboxes. */}
                  <div className="rounded-lg border border-border bg-card p-4">
                    <p className="text-meta text-foreground-muted">
                      Printed on this receipt (<span className="tabular-nums">{shown.length}</span>)
                    </p>
                    <p className="mt-1 text-cell">
                      {shown.length > 0
                        ? shown.map((option) => option.label).join(", ")
                        : "No fields are switched on."}
                    </p>
                  </div>

                  {hidden.length > 0 ? (
                    <div className="rounded-lg border border-border bg-card p-4">
                      <p className="text-meta text-foreground-muted">
                        Hidden (<span className="tabular-nums">{hidden.length}</span>)
                      </p>
                      <p className="mt-1 text-cell text-foreground-muted">
                        {hidden.map((option) => option.label).join(", ")}
                      </p>
                    </div>
                  ) : null}

                  <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-3">
                    <InfoField label="Font size" value={layout.layoutConfig.fontSize} />
                    <InfoField label="Alignment" value={layout.layoutConfig.alignment} />
                    <InfoField label="Spacing" value={layout.layoutConfig.spacing} />
                  </div>

                  {layout.layoutConfig.footerMessage || layout.layoutConfig.termsText ? (
                    <div className="grid gap-3 rounded-lg border border-border bg-card p-4">
                      {layout.layoutConfig.footerMessage ? (
                        <InfoField
                          label="Footer message"
                          value={layout.layoutConfig.footerMessage}
                        />
                      ) : null}
                      {layout.layoutConfig.termsText ? (
                        <InfoField label="Terms" value={layout.layoutConfig.termsText} />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          // Radix requires a title on every open sheet, including this one.
          <SheetHeader>
            <SheetTitle className="sr-only">Receipt layout</SheetTitle>
            <SheetDescription>No layout selected.</SheetDescription>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}
