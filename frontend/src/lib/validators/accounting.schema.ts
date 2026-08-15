import { z } from "zod";

const optionalNullableString = z.union([z.string(), z.null(), z.undefined()]).transform((value) => {
  if (typeof value !== "string") return null;

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
});

export const chartAccountCreateSchema = z.object({
  accountCode: z.string().trim().min(1, "Account code is required."),
  accountGroup: z.string().trim().min(1, "Account group is required."),
  accountName: z.string().trim().min(1, "Account name is required."),
  accountType: z.enum(["asset", "liability", "equity", "income", "cogs", "expense"]),
  allowManualPosting: z.boolean(),
  description: z.string(),
  isControlAccount: z.boolean(),
  parentAccountId: optionalNullableString,
});

export const chartAccountUpdateSchema = z.object({
  accountGroup: z.string().trim().min(1, "Account group is required."),
  accountName: z.string().trim().min(1, "Account name is required."),
  accountCode: z.string().trim().min(1, "Account code is required.").optional(),
  accountType: z.enum(["asset", "liability", "equity", "income", "cogs", "expense"]).optional(),
  normalBalance: z.enum(["debit", "credit"]).optional(),
  allowManualPosting: z.boolean(),
  description: z.string(),
  isControlAccount: z.boolean(),
  parentAccountId: optionalNullableString,
});

export const journalEntryLineSchema = z.object({
  accountId: z.string().trim().min(1, "Account is required."),
  creditAmount: z.number().min(0, "Credit amount cannot be negative."),
  debitAmount: z.number().min(0, "Debit amount cannot be negative."),
  description: z.string(),
});

export const journalEntrySchema = z
  .object({
    branchId: optionalNullableString,
    entryDate: z.string().trim().min(1, "Entry date is required."),
    lines: z.array(journalEntryLineSchema).min(2, "At least 2 journal lines are required."),
    narration: z.string().trim().min(1, "Narration is required."),
    referenceNumber: z.string(),
    sourceId: z.null(),
    sourceType: z.literal("manual"),
  })
  .superRefine((value, context) => {
    value.lines.forEach((line, index) => {
      const hasDebit = line.debitAmount > 0;
      const hasCredit = line.creditAmount > 0;

      if (hasDebit && hasCredit) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A line cannot have both debit and credit.",
          path: ["lines", index],
        });
      }

      if (!hasDebit && !hasCredit) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Each line needs either a debit or credit amount.",
          path: ["lines", index],
        });
      }
    });

    const totalDebit = value.lines.reduce((sum, line) => sum + line.debitAmount, 0);
    const totalCredit = value.lines.reduce((sum, line) => sum + line.creditAmount, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.005) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Total debit must equal total credit.",
        path: ["lines"],
      });
    }
  });

export const paymentAccountSchema = z
  .object({
    accountName: z.string().trim().min(1, "Payment account name is required."),
    accountType: z.enum([
      "cash",
      "bank",
      "card_clearing",
      "platform_clearing",
      "wallet",
      "store_credit",
      "other",
    ]),
    branchId: optionalNullableString,
    chartAccountId: z.string().trim().min(1, "Linked chart account is required."),
    description: z.string(),
    status: z.enum(["active", "inactive"]),
    openingBalance: z.number().finite("Opening balance must be a number."),
    openingBalanceDate: optionalNullableString,
  })
  .refine((values) => values.openingBalance === 0 || Boolean(values.openingBalanceDate), {
    message: "Pick the date the opening balance applies from.",
    path: ["openingBalanceDate"],
  })
  .refine((values) => values.accountType !== "store_credit" || values.openingBalance === 0, {
    message: "Store credit accounts cannot carry an opening balance.",
    path: ["openingBalance"],
  });

export const accountTransferSchema = z
  .object({
    amount: z.number().positive("Transfer amount must be greater than 0."),
    branchId: optionalNullableString,
    fromPaymentAccountId: z.string().trim().min(1, "Source account is required."),
    notes: z.string(),
    referenceNumber: z.string(),
    toPaymentAccountId: z.string().trim().min(1, "Target account is required."),
    transferDate: z.string().trim().min(1, "Transfer date is required."),
  })
  .refine((value) => value.fromPaymentAccountId !== value.toPaymentAccountId, {
    message: "Source and target accounts must be different.",
    path: ["toPaymentAccountId"],
  });

export const platformSettlementDeductionSchema = z.object({
  amount: z.number().min(0, "Deduction amount cannot be negative."),
  deductionType: z.string().trim().min(1, "Deduction type is required."),
  description: z.string(),
  expenseAccountId: z.string().trim().min(1, "Expense account is required."),
});

export const platformSettlementSchema = z
  .object({
    branchId: optionalNullableString,
    deductions: z.array(platformSettlementDeductionSchema),
    depositPaymentAccountId: z.string().trim().min(1, "Deposit account is required."),
    grossAmount: z.number().positive("Gross amount must be greater than 0."),
    netReceivedAmount: z.number().min(0, "Net received amount cannot be negative."),
    notes: z.string(),
    platformPaymentAccountId: z.string().trim().min(1, "Platform account is required."),
    referenceNumber: z.string(),
    settlementDate: z.string().trim().min(1, "Settlement date is required."),
  })
  .refine((value) => value.platformPaymentAccountId !== value.depositPaymentAccountId, {
    message: "Platform and deposit accounts must be different.",
    path: ["depositPaymentAccountId"],
  });

export type ChartAccountCreateValues = z.infer<typeof chartAccountCreateSchema>;
export type ChartAccountUpdateValues = z.infer<typeof chartAccountUpdateSchema>;
export type AccountTransferValues = z.infer<typeof accountTransferSchema>;
export type JournalEntryValues = z.infer<typeof journalEntrySchema>;
export type PaymentAccountValues = z.infer<typeof paymentAccountSchema>;
export type PlatformSettlementValues = z.infer<typeof platformSettlementSchema>;
