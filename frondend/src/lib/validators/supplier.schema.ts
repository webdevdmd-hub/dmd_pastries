import { z } from "zod";

const optionalTrimmedString = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null))
  .nullable()
  .optional();

const optionalEmail = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .or(z.literal(""))
  .transform((value) => (value.length > 0 ? value : null))
  .nullable()
  .optional();

const optionalWebsite = z
  .string()
  .trim()
  .url("Enter a valid website URL.")
  .or(z.literal(""))
  .transform((value) => (value.length > 0 ? value : null))
  .nullable()
  .optional();

const supplierStatusSchema = z.enum(["active", "inactive", "blocked"]);

const supplierBaseSchema = z.object({
  supplierName: z.string().trim().min(2, "Supplier name is required."),
  phone: optionalTrimmedString,
  email: optionalEmail,
  website: optionalWebsite,
  addressLine1: optionalTrimmedString,
  addressLine2: optionalTrimmedString,
  city: optionalTrimmedString,
  state: optionalTrimmedString,
  country: optionalTrimmedString,
  postalCode: optionalTrimmedString,
  taxNumber: optionalTrimmedString,
  notes: optionalTrimmedString,
});

export const createSupplierSchema = supplierBaseSchema;

export const updateSupplierSchema = supplierBaseSchema.partial();

export const updateSupplierStatusSchema = z.object({
  status: supplierStatusSchema,
});

export const createSupplierContactSchema = z.object({
  contactName: z.string().trim().min(2, "Contact name is required."),
  contactRole: optionalTrimmedString,
  phone: optionalTrimmedString,
  email: optionalEmail,
  isPrimary: z.boolean(),
  notes: optionalTrimmedString,
});

export const updateSupplierContactSchema = createSupplierContactSchema.partial();

export const createSupplierNoteSchema = z.object({
  note: z
    .string()
    .trim()
    .min(1, "Note is required.")
    .max(1000, "Note must be 1000 characters or fewer."),
});

export const supplierFiltersSchema = z.object({
  search: z.string(),
  status: z.union([supplierStatusSchema, z.literal("all")]),
  country: z.string(),
});

export type CreateSupplierFormValues = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierFormValues = z.infer<typeof updateSupplierSchema>;
export type CreateSupplierContactFormValues = z.infer<typeof createSupplierContactSchema>;
export type UpdateSupplierContactFormValues = z.infer<typeof updateSupplierContactSchema>;
export type CreateSupplierNoteFormValues = z.infer<typeof createSupplierNoteSchema>;
