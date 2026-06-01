"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSX } from "react";

import { PurchaseReceiptActionsMenu } from "@/components/purchasing/purchase-receipt-actions-menu";
import { PurchaseReceiptStatusBadge } from "@/components/purchasing/purchase-receipt-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/constants/routes";
import type { PurchaseReceipt } from "@/types/purchasing";

function formatDate(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value))
    : "Not set";
}

export function PurchaseReceiptsTable({
  canManage,
  onCancel,
  onPost,
  receipts,
}: {
  canManage: boolean;
  onCancel: (receipt: PurchaseReceipt) => void;
  onPost: (receipt: PurchaseReceipt) => void;
  receipts: PurchaseReceipt[];
}): JSX.Element {
  const router = useRouter();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Receipt Number</TableHead>
          <TableHead>Supplier</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>Received Date</TableHead>
          <TableHead>Linked PO</TableHead>
          <TableHead>Linked Invoice</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Received By</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {receipts.map((receipt) => (
          <TableRow key={receipt.id}>
            <TableCell>
              <Link
                className="font-semibold text-brand-espresso"
                href={`${ROUTES.purchasingReceipts}/${receipt.id}`}
              >
                {receipt.receiptNumber}
              </Link>
            </TableCell>
            <TableCell>{receipt.supplierName}</TableCell>
            <TableCell>{receipt.branchName}</TableCell>
            <TableCell>{formatDate(receipt.receivedDate)}</TableCell>
            <TableCell>{receipt.purchaseOrderId ?? "Not linked"}</TableCell>
            <TableCell>{receipt.purchaseInvoiceId ?? "Not linked"}</TableCell>
            <TableCell>
              <PurchaseReceiptStatusBadge status={receipt.status} />
            </TableCell>
            <TableCell>{receipt.receivedByUserName}</TableCell>
            <TableCell>
              <PurchaseReceiptActionsMenu
                canManage={canManage}
                onCancel={onCancel}
                onPost={onPost}
                onView={(selectedReceipt) =>
                  router.push(`${ROUTES.purchasingReceipts}/${selectedReceipt.id}`)
                }
                receipt={receipt}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
