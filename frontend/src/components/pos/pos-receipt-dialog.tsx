"use client";

import { Download, Printer } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SaleReceipt } from "@/types/pos";
import type { ReceiptLayout, ReceiptLayoutConfig, ReceiptLayoutType } from "@/types/settings";

type POSReceiptDialogProps = {
  layout: ReceiptLayout | null;
  onNewSale: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  primaryActionLabel?: string;
  receipt: SaleReceipt | null;
};

const fallbackLayoutConfig: ReceiptLayoutConfig = {
  alignment: "center",
  fontSize: "medium",
  footerMessage: "Thank you for your purchase.",
  showAddress: false,
  showBranchName: true,
  showBusinessName: true,
  showCashier: true,
  showCustomer: false,
  showDiscount: true,
  showLogo: false,
  showPaymentMethod: true,
  showPhone: false,
  showQrCode: false,
  showTax: true,
  showTaxNumber: false,
  showUnitPrice: true,
  spacing: "normal",
  termsText: "",
};

const receiptTypeLabels: Record<ReceiptLayoutType, string> = {
  "58mm": "58mm",
  "80mm": "80mm",
  a4: "A4",
  custom: "Custom",
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    style: "currency",
  }).format(value);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-AE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function buildReceiptText(receipt: SaleReceipt, config: ReceiptLayoutConfig): string {
  const lines = [
    config.showBusinessName ? receipt.businessName : null,
    config.showBranchName ? receipt.branchName : null,
    `Sale #${receipt.saleNumber}`,
    formatDateTime(receipt.soldAt),
    config.showCashier ? `Cashier: ${receipt.cashierName}` : null,
    "",
    ...receipt.items.flatMap((item) => [
      `${String(item.quantity)} x ${item.name} ${formatMoney(item.lineTotal)}`,
      config.showUnitPrice ? `  Unit: ${formatMoney(item.unitPrice)}` : null,
    ]),
    "",
    `Subtotal: ${formatMoney(receipt.subtotal)}`,
    config.showDiscount ? `Discount: ${formatMoney(receipt.discountAmount)}` : null,
    config.showTax ? `Tax: ${formatMoney(receipt.taxAmount)}` : null,
    `Total: ${formatMoney(receipt.total)}`,
    `Paid: ${formatMoney(receipt.paidAmount)}`,
    `Change: ${formatMoney(receipt.changeAmount)}`,
    config.showPaymentMethod
      ? `Payment: ${receipt.payments.map((payment) => payment.paymentMethodName).join(", ")}`
      : null,
    "",
    config.footerMessage || null,
    config.termsText || null,
  ];

  return lines.filter((line): line is string => line !== null).join("\n");
}

function downloadReceipt(receipt: SaleReceipt, config: ReceiptLayoutConfig): void {
  const blob = new Blob([buildReceiptText(receipt, config)], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `${receipt.saleNumber}-receipt.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function POSReceiptDialog({
  layout,
  onNewSale,
  onOpenChange,
  open,
  primaryActionLabel = "New sale",
  receipt,
}: POSReceiptDialogProps): JSX.Element {
  const config = layout?.layoutConfig ?? fallbackLayoutConfig;
  const receiptType = layout?.receiptType ?? "80mm";
  const alignClass = config.alignment === "left" ? "text-left" : "text-center";
  const fontClass =
    config.fontSize === "small" ? "text-xs" : config.fontSize === "large" ? "text-base" : "text-sm";
  const spacingClass =
    config.spacing === "compact"
      ? "space-y-2"
      : config.spacing === "relaxed"
        ? "space-y-5"
        : "space-y-4";
  const widthClass =
    receiptType === "58mm" ? "max-w-[17rem]" : receiptType === "a4" ? "max-w-xl" : "max-w-sm";

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className={receiptType === "a4" ? "sm:max-w-3xl" : "sm:max-w-md"}>
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            Sale receipt
            <span className="rounded-full bg-brand-cappuccino/60 px-3 py-1 text-xs font-semibold text-brand-mocha">
              {layout
                ? `${layout.layoutName} · ${receiptTypeLabels[receiptType]}`
                : "Default template"}
            </span>
          </DialogTitle>
        </DialogHeader>
        {receipt ? (
          <div
            className={`${widthClass} ${spacingClass} ${fontClass} ${alignClass} mx-auto rounded-3xl bg-white p-4 text-brand-espresso print:shadow-none`}
          >
            <div className={spacingClass}>
              {config.showLogo ? (
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-cappuccino/60">
                  <Printer className="h-5 w-5" />
                </div>
              ) : null}
              {config.showBusinessName ? (
                <p className="font-display text-2xl font-bold">{receipt.businessName}</p>
              ) : null}
              {config.showBranchName ? (
                <p className="text-brand-mocha">{receipt.branchName}</p>
              ) : null}
              {config.showAddress ? (
                <p className="text-xs text-brand-mocha">Branch address</p>
              ) : null}
              {config.showPhone ? <p className="text-xs text-brand-mocha">Phone number</p> : null}
              {config.showTaxNumber ? (
                <p className="text-xs text-brand-mocha">Tax/VAT number</p>
              ) : null}
              <p className="text-xs text-brand-mocha">Sale #{receipt.saleNumber}</p>
              <p className="text-xs text-brand-mocha">{formatDateTime(receipt.soldAt)}</p>
              {config.showCashier ? (
                <p className="text-xs text-brand-mocha">Cashier: {receipt.cashierName}</p>
              ) : null}
              {config.showCustomer ? (
                <p className="text-xs text-brand-mocha">Customer: Walk-in</p>
              ) : null}
            </div>
            <div className="space-y-2">
              {receipt.items.map((item, index) => (
                <div className="space-y-1" key={`${item.name}-${String(index)}`}>
                  <div className="flex justify-between gap-3 text-left">
                    <span>
                      {item.quantity} x {item.name}
                    </span>
                    <strong>{formatMoney(item.lineTotal)}</strong>
                  </div>
                  {config.showUnitPrice ? (
                    <p className="text-left text-xs text-brand-mocha">
                      Unit price: {formatMoney(item.unitPrice)}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="space-y-1 border-t border-brand-cappuccino pt-3">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatMoney(receipt.subtotal)}</span>
              </div>
              {config.showDiscount ? (
                <div className="flex justify-between">
                  <span>Discount</span>
                  <span>{formatMoney(receipt.discountAmount)}</span>
                </div>
              ) : null}
              {config.showTax ? (
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>{formatMoney(receipt.taxAmount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-lg font-black">
                <span>Total</span>
                <span>{formatMoney(receipt.total)}</span>
              </div>
              <div className="flex justify-between">
                <span>Paid</span>
                <span>{formatMoney(receipt.paidAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Change</span>
                <span>{formatMoney(receipt.changeAmount)}</span>
              </div>
              {config.showPaymentMethod ? (
                <div className="text-left text-xs text-brand-mocha">
                  {receipt.payments.map((payment) => (
                    <p key={payment.paymentMethodId}>
                      {payment.paymentMethodName}: {formatMoney(payment.amount)}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
            {config.showQrCode ? (
              <div
                className="mx-auto h-14 w-14 rounded-lg bg-brand-espresso/15"
                aria-label="Receipt QR code placeholder"
              />
            ) : null}
            {config.footerMessage ? <p>{config.footerMessage}</p> : null}
            {config.termsText ? (
              <p className="text-xs text-brand-mocha">{config.termsText}</p>
            ) : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button
            disabled={!receipt}
            onClick={() => {
              if (receipt) {
                downloadReceipt(receipt, config);
              }
            }}
            type="button"
            variant="outline"
          >
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
          <Button onClick={() => window.print()} type="button" variant="outline">
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button onClick={onNewSale} type="button">
            {primaryActionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
