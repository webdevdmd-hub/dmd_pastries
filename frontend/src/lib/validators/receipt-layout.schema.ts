import { z } from "zod";

export const receiptLayoutTypes = ["58mm", "80mm", "a4", "custom"] as const;

export const receiptLayoutConfigSchema = z.object({
  showLogo: z.boolean(),
  showBusinessName: z.boolean(),
  showBranchName: z.boolean(),
  showAddress: z.boolean(),
  showPhone: z.boolean(),
  showTaxNumber: z.boolean(),
  showCashier: z.boolean(),
  showCustomer: z.boolean(),
  showUnitPrice: z.boolean(),
  showDiscount: z.boolean(),
  showTax: z.boolean(),
  showPaymentMethod: z.boolean(),
  showQrCode: z.boolean(),
  fontSize: z.enum(["small", "medium", "large"]),
  alignment: z.enum(["left", "center"]),
  spacing: z.enum(["compact", "normal", "relaxed"]),
  footerMessage: z.string().max(240),
  termsText: z.string().max(500),
});

export const receiptLayoutSchema = z
  .object({
    branchId: z.string().uuid().nullable(),
    counterId: z.string().max(80).nullable(),
    isDefault: z.boolean(),
    layoutName: z.string().trim().min(2, "Layout name is required.").max(80),
    printerType: z.string().max(80).nullable(),
    receiptType: z.enum(receiptLayoutTypes),
    status: z.enum(["active", "inactive"]),
    layoutConfig: receiptLayoutConfigSchema,
  })
  .refine((value) => !(value.isDefault && value.status === "inactive"), {
    message: "Only active receipt layouts can be default.",
    path: ["isDefault"],
  });

export type ReceiptLayoutSchema = z.infer<typeof receiptLayoutSchema>;
