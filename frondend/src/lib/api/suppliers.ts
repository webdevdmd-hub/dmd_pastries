import { apiRequest } from "@/lib/api/client";
import type {
  CreateSupplierContactPayload,
  CreateSupplierNotePayload,
  CreateSupplierPayload,
  Supplier,
  SupplierContact,
  SupplierFilters,
  SupplierLookupParams,
  SupplierNote,
  SupplierStats,
  SupplierStatus,
  UpdateSupplierContactPayload,
  UpdateSupplierPayload,
  UpdateSupplierStatusPayload,
} from "@/types/supplier";

type BackendSupplierPayload = {
  supplier_name?: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  tax_number?: string | null;
  notes?: string | null;
};

type BackendSupplierContactPayload = {
  contact_name?: string;
  contact_role?: string | null;
  phone?: string | null;
  email?: string | null;
  is_primary?: boolean;
  notes?: string | null;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function isSupplierStatus(value: unknown): value is SupplierStatus {
  return value === "active" || value === "inactive" || value === "blocked";
}

function parseList<TItem>(value: unknown, parser: (item: unknown) => TItem): TItem[] {
  if (Array.isArray(value)) {
    return value.map(parser);
  }

  if (isObject(value) && Array.isArray(value.items)) {
    return value.items.map(parser);
  }

  if (isObject(value) && Array.isArray(value.suppliers)) {
    return value.suppliers.map(parser);
  }

  if (isObject(value) && Array.isArray(value.contacts)) {
    return value.contacts.map(parser);
  }

  if (isObject(value) && Array.isArray(value.notes)) {
    return value.notes.map(parser);
  }

  if (isObject(value) && Array.isArray(value.data)) {
    return value.data.map(parser);
  }

  throw new Error("Backend list payload is invalid.");
}

function parseContactOrNull(value: unknown): SupplierContact | null {
  if (!isObject(value)) {
    return null;
  }

  return parseContact(value);
}

function parseContact(value: unknown): SupplierContact {
  if (!isObject(value)) {
    throw new Error("Backend supplier contact payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    businessId: stringValue(value.business_id),
    supplierId: stringValue(value.supplier_id),
    contactName: stringValue(value.contact_name, "Contact"),
    contactRole: optionalString(value.contact_role),
    phone: optionalString(value.phone),
    email: optionalString(value.email),
    isPrimary: booleanValue(value.is_primary),
    notes: optionalString(value.notes),
    createdAt: stringValue(value.created_at),
    updatedAt: stringValue(value.updated_at),
  };
}

function parseSupplier(value: unknown): Supplier {
  if (!isObject(value)) {
    throw new Error("Backend supplier payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    businessId: stringValue(value.business_id),
    supplierCode: stringValue(value.supplier_code, "Supplier"),
    supplierName: stringValue(value.supplier_name, "Unnamed supplier"),
    phone: optionalString(value.phone),
    email: optionalString(value.email),
    website: optionalString(value.website),
    addressLine1: optionalString(value.address_line_1),
    addressLine2: optionalString(value.address_line_2),
    city: optionalString(value.city),
    state: optionalString(value.state),
    country: optionalString(value.country),
    postalCode: optionalString(value.postal_code),
    taxNumber: optionalString(value.tax_number),
    notes: optionalString(value.notes),
    status: isSupplierStatus(value.status) ? value.status : "active",
    primaryContact: parseContactOrNull(value.primary_contact),
    createdByUserId: optionalString(value.created_by_user_id),
    updatedByUserId: optionalString(value.updated_by_user_id),
    createdAt: stringValue(value.created_at),
    updatedAt: stringValue(value.updated_at),
  };
}

function parseNote(value: unknown): SupplierNote {
  if (!isObject(value)) {
    throw new Error("Backend supplier note payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    businessId: stringValue(value.business_id),
    supplierId: stringValue(value.supplier_id),
    note: stringValue(value.note),
    createdByUserId: optionalString(value.created_by_user_id),
    createdByUserName: stringValue(value.created_by_user_name, "User"),
    createdAt: stringValue(value.created_at),
    updatedAt: stringValue(value.updated_at),
  };
}

function parseStats(value: unknown): SupplierStats {
  if (!isObject(value)) {
    throw new Error("Backend supplier stats payload is invalid.");
  }

  return {
    totalPurchaseOrders: numberValue(value.total_purchase_orders),
    totalPurchaseAmount: numberValue(value.total_purchase_amount),
    lastPurchaseDate: optionalString(value.last_purchase_date),
  };
}

function toQueryString(params: Record<string, string | number | null | undefined>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== "all") {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function supplierPayload(
  payload: CreateSupplierPayload | UpdateSupplierPayload,
): BackendSupplierPayload {
  const nextPayload: BackendSupplierPayload = {};

  if (payload.supplierName !== undefined) nextPayload.supplier_name = payload.supplierName;
  if (payload.phone !== undefined) nextPayload.phone = payload.phone;
  if (payload.email !== undefined) nextPayload.email = payload.email;
  if (payload.website !== undefined) nextPayload.website = payload.website;
  if (payload.addressLine1 !== undefined) nextPayload.address_line_1 = payload.addressLine1;
  if (payload.addressLine2 !== undefined) nextPayload.address_line_2 = payload.addressLine2;
  if (payload.city !== undefined) nextPayload.city = payload.city;
  if (payload.state !== undefined) nextPayload.state = payload.state;
  if (payload.country !== undefined) nextPayload.country = payload.country;
  if (payload.postalCode !== undefined) nextPayload.postal_code = payload.postalCode;
  if (payload.taxNumber !== undefined) nextPayload.tax_number = payload.taxNumber;
  if (payload.notes !== undefined) nextPayload.notes = payload.notes;

  return nextPayload;
}

function contactPayload(
  payload: CreateSupplierContactPayload | UpdateSupplierContactPayload,
): BackendSupplierContactPayload {
  const nextPayload: BackendSupplierContactPayload = {};

  if (payload.contactName !== undefined) nextPayload.contact_name = payload.contactName;
  if (payload.contactRole !== undefined) nextPayload.contact_role = payload.contactRole;
  if (payload.phone !== undefined) nextPayload.phone = payload.phone;
  if (payload.email !== undefined) nextPayload.email = payload.email;
  if (payload.isPrimary !== undefined) nextPayload.is_primary = payload.isPrimary;
  if (payload.notes !== undefined) nextPayload.notes = payload.notes;

  return nextPayload;
}

export async function getSuppliers(params: SupplierFilters): Promise<Supplier[]> {
  const response = await apiRequest<Supplier[]>(
    `/api/v1/suppliers${toQueryString({
      search: params.search,
      status: params.status,
      country: params.country,
    })}`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseSupplier),
    },
  );

  return response.data;
}

export async function createSupplier(payload: CreateSupplierPayload): Promise<Supplier> {
  const response = await apiRequest<Supplier, BackendSupplierPayload>("/api/v1/suppliers", {
    method: "POST",
    authMode: "appwrite",
    body: supplierPayload(payload),
    parse: parseSupplier,
  });

  return response.data;
}

export async function getSupplierById(id: string): Promise<Supplier> {
  const response = await apiRequest<Supplier>(`/api/v1/suppliers/${id}`, {
    authMode: "appwrite",
    parse: parseSupplier,
  });

  return response.data;
}

export async function updateSupplier(
  id: string,
  payload: UpdateSupplierPayload,
): Promise<Supplier> {
  const response = await apiRequest<Supplier, BackendSupplierPayload>(`/api/v1/suppliers/${id}`, {
    method: "PATCH",
    authMode: "appwrite",
    body: supplierPayload(payload),
    parse: parseSupplier,
  });

  return response.data;
}

export async function updateSupplierStatus(
  id: string,
  payload: UpdateSupplierStatusPayload,
): Promise<Supplier> {
  const response = await apiRequest<Supplier, UpdateSupplierStatusPayload>(
    `/api/v1/suppliers/${id}/status`,
    {
      method: "PATCH",
      authMode: "appwrite",
      body: payload,
      parse: parseSupplier,
    },
  );

  return response.data;
}

export async function deleteSupplier(id: string): Promise<void> {
  await apiRequest<void>(`/api/v1/suppliers/${id}`, {
    method: "DELETE",
    authMode: "appwrite",
    parse: () => undefined,
  });
}

export async function lookupSuppliers(params: SupplierLookupParams): Promise<Supplier[]> {
  const response = await apiRequest<Supplier[]>(
    `/api/v1/suppliers/lookup${toQueryString({
      search: params.search,
      limit: params.limit,
    })}`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseSupplier),
    },
  );

  return response.data;
}

export async function getSupplierContacts(supplierId: string): Promise<SupplierContact[]> {
  const response = await apiRequest<SupplierContact[]>(`/api/v1/suppliers/${supplierId}/contacts`, {
    authMode: "appwrite",
    parse: (data) => parseList(data, parseContact),
  });

  return response.data;
}

export async function createSupplierContact(
  supplierId: string,
  payload: CreateSupplierContactPayload,
): Promise<SupplierContact> {
  const response = await apiRequest<SupplierContact, BackendSupplierContactPayload>(
    `/api/v1/suppliers/${supplierId}/contacts`,
    {
      method: "POST",
      authMode: "appwrite",
      body: contactPayload(payload),
      parse: parseContact,
    },
  );

  return response.data;
}

export async function updateSupplierContact(
  supplierId: string,
  contactId: string,
  payload: UpdateSupplierContactPayload,
): Promise<SupplierContact> {
  const response = await apiRequest<SupplierContact, BackendSupplierContactPayload>(
    `/api/v1/suppliers/${supplierId}/contacts/${contactId}`,
    {
      method: "PATCH",
      authMode: "appwrite",
      body: contactPayload(payload),
      parse: parseContact,
    },
  );

  return response.data;
}

export async function deleteSupplierContact(supplierId: string, contactId: string): Promise<void> {
  await apiRequest<void>(`/api/v1/suppliers/${supplierId}/contacts/${contactId}`, {
    method: "DELETE",
    authMode: "appwrite",
    parse: () => undefined,
  });
}

export async function getSupplierNotes(supplierId: string): Promise<SupplierNote[]> {
  const response = await apiRequest<SupplierNote[]>(`/api/v1/suppliers/${supplierId}/notes`, {
    authMode: "appwrite",
    parse: (data) => parseList(data, parseNote),
  });

  return response.data;
}

export async function createSupplierNote(
  supplierId: string,
  payload: CreateSupplierNotePayload,
): Promise<SupplierNote> {
  const response = await apiRequest<SupplierNote, CreateSupplierNotePayload>(
    `/api/v1/suppliers/${supplierId}/notes`,
    {
      method: "POST",
      authMode: "appwrite",
      body: payload,
      parse: parseNote,
    },
  );

  return response.data;
}

export async function deleteSupplierNote(supplierId: string, noteId: string): Promise<void> {
  await apiRequest<void>(`/api/v1/suppliers/${supplierId}/notes/${noteId}`, {
    method: "DELETE",
    authMode: "appwrite",
    parse: () => undefined,
  });
}

export async function getSupplierStats(supplierId: string): Promise<SupplierStats> {
  const response = await apiRequest<SupplierStats>(`/api/v1/suppliers/${supplierId}/stats`, {
    authMode: "appwrite",
    parse: parseStats,
  });

  return response.data;
}
