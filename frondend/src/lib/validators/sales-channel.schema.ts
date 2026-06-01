import { z } from "zod";

const nullableString = z
  .string()
  .nullable()
  .transform((value) => {
    if (typeof value !== "string") return null;

    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
  });

export const salesChannelSchema = z.object({
  channelName: z.string().trim().min(1, "Channel name is required."),
  channelType: z.string().trim().min(1, "Channel type is required."),
  commissionRate: z.number().min(0, "Commission cannot be negative."),
  defaultPaymentMethodId: nullableString,
  isDefault: z.boolean(),
  requiresExternalOrderNumber: z.boolean(),
  status: z.enum(["active", "inactive"]),
});

export type SalesChannelValues = z.infer<typeof salesChannelSchema>;
