"use client";

import Link from "next/link";
import type { JSX, ReactNode } from "react";

import type { PurchaseReturnDetailTabKey } from "@/components/purchasing/purchase-return-detail-tabs";
import {
  PURCHASE_RETURN_DETAIL_TABPANEL_ID,
  PurchaseReturnDetailViewTabs,
} from "@/components/purchasing/purchase-return-detail-view-tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/constants/routes";
import type { PurchaseReturn } from "@/types/purchasing";

type PurchaseReturnDetailsPanelProps = {
  activeTab: PurchaseReturnDetailTabKey;
  onTabChange: (tab: PurchaseReturnDetailTabKey) => void;
  purchaseReturn: PurchaseReturn;
};

export function formatPurchaseReturnMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

export function formatPurchaseReturnDate(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value))
    : "Not set";
}

function DetailRow({ label, value }: { label: string; value: ReactNode }): JSX.Element {
  return (
    <div className="grid gap-0.5 rounded-lg bg-muted px-3 py-2">
      <span className="text-meta text-foreground-muted">{label}</span>
      <span className="break-words text-cell font-medium tabular-nums">{value}</span>
    </div>
  );
}

function LinkValue({ href, label }: { href: string; label: string }): JSX.Element {
  return (
    <Link className="font-mono hover:underline" href={href}>
      {label}
    </Link>
  );
}

/**
 * The body of a vendor credit: the tab strip and whichever panel is
 * selected. Shared by the full page and the drawer over the list, which is
 * why the tab is a prop rather than state.
 */
export function PurchaseReturnDetailsPanel({
  activeTab,
  onTabChange,
  purchaseReturn,
}: PurchaseReturnDetailsPanelProps): JSX.Element {
  const isDraft = purchaseReturn.status === "draft";
  const isPosted = purchaseReturn.status === "posted";
  const journalSearchValue = purchaseReturn.journalEntryNumber ?? purchaseReturn.journalEntryId;
  const reversalJournalSearchValue =
    purchaseReturn.reversalJournalEntryNumber ?? purchaseReturn.reversalJournalEntryId;
  const hasReversal =
    purchaseReturn.status === "reversed" ||
    purchaseReturn.reversalReturnNumber !== null ||
    purchaseReturn.originalReturnNumber !== null;

  return (
    <div className="grid gap-6">
      <PurchaseReturnDetailViewTabs
        active={activeTab}
        itemsCount={purchaseReturn.items.length}
        onTabChange={onTabChange}
        purchaseReturnId={purchaseReturn.id}
      />

      <div id={PURCHASE_RETURN_DETAIL_TABPANEL_ID} role="tabpanel" tabIndex={-1}>
        {activeTab === "overview" ? (
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-2 md:gap-3 xl:grid-cols-4">
              <DetailRow
                label="Return total"
                value={formatPurchaseReturnMoney(purchaseReturn.returnTotal)}
              />
              <DetailRow
                label="Applied credit"
                value={formatPurchaseReturnMoney(purchaseReturn.appliedCreditAmount)}
              />
              <DetailRow
                label={isDraft ? "Draft credit" : "Open credit"}
                value={formatPurchaseReturnMoney(
                  isDraft ? purchaseReturn.returnTotal : purchaseReturn.openCreditAmount,
                )}
              />
              <DetailRow
                label="Return date"
                value={formatPurchaseReturnDate(purchaseReturn.returnDate)}
              />
            </div>
            {isDraft ? (
              <p className="text-meta text-foreground-muted">
                Open credit is AED 0.00 until this vendor credit is posted.
              </p>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              <DetailRow label="Supplier" value={purchaseReturn.supplierName} />
              <DetailRow label="Branch" value={purchaseReturn.branchName} />
              <DetailRow
                label="Supplier reference"
                value={purchaseReturn.supplierReferenceNumber ?? "—"}
              />
              <DetailRow label="Created by" value={purchaseReturn.createdByUserName} />
            </div>
            <DetailRow label="Return reason" value={purchaseReturn.reason ?? "No reason added."} />
          </div>
        ) : null}

        {activeTab === "items" ? (
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Line total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseReturn.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.itemNameSnapshot}</TableCell>
                      <TableCell className="capitalize">
                        {item.itemType.replace("_", " ")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.quantity} {item.unitSymbol}
                      </TableCell>
                      <TableCell>{item.stockLocationName ?? "Default location"}</TableCell>
                      <TableCell className="min-w-64 whitespace-normal">
                        {item.reason ?? purchaseReturn.reason ?? "Not set"}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatPurchaseReturnMoney(item.lineTotal)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null}

        {activeTab === "links" ? (
          <div className="grid gap-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <DetailRow
                label="Linked receipt"
                value={
                  <LinkValue
                    href={`${ROUTES.purchasingReceipts}/${purchaseReturn.purchaseReceiptId}`}
                    label={purchaseReturn.purchaseReceiptNumber}
                  />
                }
              />
              <DetailRow
                label="Linked bill"
                value={
                  purchaseReturn.purchaseInvoiceId ? (
                    <LinkValue
                      href={`${ROUTES.purchasingInvoices}/${purchaseReturn.purchaseInvoiceId}`}
                      label={purchaseReturn.purchaseInvoiceNumber ?? "Bill number unavailable"}
                    />
                  ) : (
                    "Not linked"
                  )
                }
              />
              <DetailRow
                label="Journal reference"
                value={
                  journalSearchValue ? (
                    <LinkValue
                      href={`${ROUTES.accountingJournalEntries}?search=${journalSearchValue}`}
                      label={purchaseReturn.journalEntryNumber ?? "View journal"}
                    />
                  ) : isPosted ? (
                    <span className="text-danger-text">
                      Journal missing. Posted without a linked journal; run the purchase-return
                      journal backfill.
                    </span>
                  ) : (
                    "Not posted yet"
                  )
                }
              />
              <DetailRow
                label="Posted at"
                value={formatPurchaseReturnDate(purchaseReturn.postedAt)}
              />
            </div>

            {hasReversal ? (
              <Card className="border-info/30 bg-info-tint/60">
                <CardContent className="grid gap-2 p-4 sm:grid-cols-2">
                  <p className="text-cell font-medium sm:col-span-2">Reversal details</p>
                  <DetailRow
                    label="Original note"
                    value={purchaseReturn.originalReturnNumber ?? purchaseReturn.returnNumber}
                  />
                  <DetailRow
                    label="Reversal note"
                    value={
                      purchaseReturn.reversalReturnId ? (
                        <LinkValue
                          href={`${ROUTES.purchasingReturns}/${purchaseReturn.reversalReturnId}`}
                          label={
                            purchaseReturn.reversalReturnNumber ?? purchaseReturn.reversalReturnId
                          }
                        />
                      ) : (
                        (purchaseReturn.reversalReturnNumber ?? "Not linked")
                      )
                    }
                  />
                  <DetailRow
                    label="Reversed by"
                    value={`${purchaseReturn.reversedByUserName ?? "System"} · ${formatPurchaseReturnDate(purchaseReturn.reversedAt)}`}
                  />
                  <DetailRow
                    label="Reversal journal"
                    value={
                      reversalJournalSearchValue ? (
                        <LinkValue
                          href={`${ROUTES.accountingJournalEntries}?search=${reversalJournalSearchValue}`}
                          label={
                            purchaseReturn.reversalJournalEntryNumber ?? "View reversal journal"
                          }
                        />
                      ) : (
                        "Not linked"
                      )
                    }
                  />
                  <div className="sm:col-span-2">
                    <DetailRow
                      label="Reason"
                      value={purchaseReturn.reversalReason ?? "No reversal reason returned."}
                    />
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
