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

export type ChartAccountCreateValues = z.infer<typeof chartAccountCreateSchema>;
export type ChartAccountUpdateValues = z.infer<typeof chartAccountUpdateSchema>;
export type JournalEntryValues = z.infer<typeof journalEntrySchema>;
