import assert from "node:assert/strict";

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function calculateSalesReturnRefundPreview(items, selectedLines) {
  const itemsById = new Map(items.map((item) => [item.saleItemId, item]));

  return selectedLines.reduce(
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

function preview(item, quantity) {
  return calculateSalesReturnRefundPreview([item], [{ saleItemId: item.saleItemId, quantity }]);
}

const taxExclusiveItem = {
  saleItemId: "exclusive",
  soldQuantity: 1,
  lineSubtotal: 100,
  discountAmount: 0,
  taxAmount: 5,
  lineTotal: 105,
};

assert.deepEqual(preview(taxExclusiveItem, 1), {
  itemRefundAmount: 100,
  refundableVat: 5,
  finalRefundAmount: 105,
});

const taxInclusiveItem = {
  saleItemId: "inclusive",
  soldQuantity: 1,
  lineSubtotal: 105,
  discountAmount: 0,
  taxAmount: 5,
  lineTotal: 105,
};

assert.deepEqual(preview(taxInclusiveItem, 1), {
  itemRefundAmount: 100,
  refundableVat: 5,
  finalRefundAmount: 105,
});

const partialItem = {
  saleItemId: "partial",
  soldQuantity: 4,
  lineSubtotal: 400,
  discountAmount: 40,
  taxAmount: 18,
  lineTotal: 378,
};

assert.deepEqual(preview(partialItem, 1), {
  itemRefundAmount: 90,
  refundableVat: 4.5,
  finalRefundAmount: 94.5,
});

const previousReturnItem = {
  saleItemId: "previous-return",
  soldQuantity: 3,
  lineSubtotal: 300,
  discountAmount: 30,
  taxAmount: 13.5,
  lineTotal: 283.5,
};

assert.deepEqual(preview(previousReturnItem, 1), {
  itemRefundAmount: 90,
  refundableVat: 4.5,
  finalRefundAmount: 94.5,
});

const mixedPreview = calculateSalesReturnRefundPreview(
  [taxExclusiveItem, partialItem],
  [
    { saleItemId: "exclusive", quantity: 1 },
    { saleItemId: "partial", quantity: 2 },
  ],
);

assert.deepEqual(mixedPreview, {
  itemRefundAmount: 280,
  refundableVat: 14,
  finalRefundAmount: 294,
});
