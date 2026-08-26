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

/**
 * Phone had no validation at all, so `abcdef` saved cleanly and then became the
 * number a buyer rings when a purchase order is late. Deliberately permissive
 * about shape -- suppliers are international and write numbers a dozen ways --
 * but it insists on enough digits to actually be a phone number.
 */
const optionalPhone = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || /^\+?[\d\s().-]+$/.test(value),
    "Use digits, spaces, and + ( ) - . only.",
  )
  .refine(
    (value) => value === "" || (value.match(/\d/g) ?? []).length >= 6,
    "Enter at least 6 digits.",
  )
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

/** Mirrors the CHECK in migration 000109. "" is the not-set-yet state. */
const paymentTermsSchema = z.enum([
  "",
  "prepaid",
  "net_7",
  "net_15",
  "net_30",
  "net_45",
  "net_60",
  "net_90",
]);

/**
 * Lead time as typed: a possibly-empty string of digits, because an empty box
 * means "unknown" and 0 means same-day. Those are different answers and the
 * form has to keep them apart.
 *
 * Deliberately NOT transformed to `number | null` here. A zod transform makes
 * the schema's input and output types differ, and react-hook-form binds to the
 * input type, so the resolver stops type-checking against the form. The one
 * conversion happens at submit instead.
 */
const optionalLeadTimeDays = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d+$/.test(value), "Whole days only.")
  .refine((value) => value === "" || Number(value) <= 365, "365 days is the maximum.");

const supplierBaseSchema = z.object({
  supplierName: z.string().trim().min(2, "Supplier name is required."),
  phone: optionalPhone,
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
  paymentTerms: paymentTermsSchema,
  leadTimeDays: optionalLeadTimeDays,
  isPreferred: z.boolean(),
});

export const createSupplierSchema = supplierBaseSchema;

export const updateSupplierSchema = supplierBaseSchema.partial();

export const updateSupplierStatusSchema = z.object({
  status: supplierStatusSchema,
});

export const createSupplierContactSchema = z.object({
  contactName: z.string().trim().min(2, "Contact name is required."),
  contactRole: optionalTrimmedString,
  phone: optionalPhone,
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
