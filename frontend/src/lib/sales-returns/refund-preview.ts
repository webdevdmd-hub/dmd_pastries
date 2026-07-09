export type RefundPreviewReturnableItem = {
  saleItemId: string;
  soldQuantity: number;
  lineSubtotal: number;
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
};

export type RefundPreviewSelectedLine = {
  saleItemId: string;
  quantity: number;
};

export type RefundPreviewTotals = {
  itemRefundAmount: number;
  refundableVat: number;
  finalRefundAmount: number;
};

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateSalesReturnRefundPreview(
  items: RefundPreviewReturnableItem[],
  selectedLines: RefundPreviewSelectedLine[],
): RefundPreviewTotals {
  const itemsById = new Map(items.map((item) => [item.saleItemId, item]));

  return selectedLines.reduce<RefundPreviewTotals>(
    (totals, line) => {
      const item = itemsById.get(line.saleItemId);
      if (!item || item.soldQuantity <= 0 || line.quantity <= 0) {
        return totals;
      }

      const ratio = line.quantity / item.soldQuantity;
      const lineSubtotal = roundMoney(item.lineSubtotal * ratio);
      const discountAmount = roundMoney(item.discountAmount * ratio);
      const taxAmount = roundMoney(item.taxAmount * ratio);
      const lineTotal = roundMoney(item.lineTotal * ratio);
      const netAmount = roundMoney(Math.max(lineTotal - taxAmount, 0));
      const fallbackNetAmount = roundMoney(Math.max(lineSubtotal - discountAmount, 0));

      return {
        itemRefundAmount: roundMoney(
          totals.itemRefundAmount + (netAmount > 0 ? netAmount : fallbackNetAmount),
        ),
        refundableVat: roundMoney(totals.refundableVat + taxAmount),
        finalRefundAmount: roundMoney(totals.finalRefundAmount + lineTotal),
      };
    },
    { itemRefundAmount: 0, refundableVat: 0, finalRefundAmount: 0 },
  );
}
