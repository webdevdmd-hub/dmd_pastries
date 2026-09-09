import { z } from "zod";

export const companySettingsSchema = z.object({
  businessDisplayName: z.string().min(2, "Business display name must be at least 2 characters."),
  // Named for what it holds. It was called logoUrl and carried an Appwrite
  // file id, which is how the value ended up being sent to a logo_url field
  // the API does not have.
  logoFileId: z.string(),
  logoStoragePath: z.string(),
  // Carried so the preview can fall back to a logo set before file ids
  // existed. Read-only: it is never sent back, because the API has no field
  // for it and never did.
  logoUrl: z.string(),
  address: z.string(),
  phone: z.string().regex(/^[0-9+\-\s()]*$/, "Enter a valid phone number."),
  email: z.string().email("Enter a valid email address.").or(z.literal("")),
  website: z.string().url("Enter a valid website URL.").or(z.literal("")),
  vatNumber: z.string(),
  currency: z
    .string()
    .min(3, "Currency must use a 3-letter code.")
    .max(3, "Currency must use a 3-letter code."),
  timezone: z.string().min(1, "Timezone is required."),
  invoiceFooter: z.string(),
  receiptFooter: z.string(),
});

export type CompanySettingsSchema = z.infer<typeof companySettingsSchema>;
