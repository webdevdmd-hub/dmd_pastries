import { apiRequest } from "@/lib/api/client";
import type {
  AssignCustomerTagPayload,
  CreateCustomerNotePayload,
  CreateCustomerPayload,
  CreateCustomerTagPayload,
  Customer,
  CustomerFilters,
  CustomerGender,
  CustomerLookupParams,
  CustomerNote,
  CustomerStats,
  CustomerStatus,
  CustomerTag,
  CustomerTransaction,
  CustomerTransactionSource,
  QuickCreateCustomerPayload,
  UpdateCustomerPayload,
  UpdateCustomerStatusPayload,
  UpdateCustomerTagPayload,
} from "@/types/customer";

type BackendCustomerPayload = {
  full_name?: string;
  phone?: string | null;
  email?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  notes?: string | null;
  tag_ids?: string[];
};

type BackendCustomerTagPayload = {
  tag_name?: string;
  color?: string | null;
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

function isCustomerTransactionSource(value: unknown): value is CustomerTransactionSource {
  return (
    value === "pos_sale" ||
    value === "bakery_order" ||
    value === "pos_payment" ||
    value === "bakery_payment" ||
    value === "refund" ||
    value === "sale_refund"
  );
}

function isCustomerStatus(value: unknown): value is CustomerStatus {
  return value === "active" || value === "inactive" || value === "blocked";
}

function isCustomerGender(value: unknown): value is CustomerGender {
  return (
    value === "male" || value === "female" || value === "other" || value === "prefer_not_to_say"
  );
}

function parseList<TItem>(value: unknown, parser: (item: unknown) => TItem): TItem[] {
  if (Array.isArray(value)) {
    return value.map(parser);
  }

  if (isObject(value) && Array.isArray(value.items)) {
    return value.items.map(parser);
  }

  if (isObject(value) && Array.isArray(value.customers)) {
    return value.customers.map(parser);
  }

  if (isObject(value) && Array.isArray(value.data)) {
    return value.data.map(parser);
  }

  throw new Error("Backend list payload is invalid.");
}

function parseTag(value: unknown): CustomerTag {
  if (!isObject(value)) {
    throw new Error("Backend customer tag payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    businessId: stringValue(value.business_id),
    tagName: stringValue(value.tag_name, "Tag"),
    color: optionalString(value.color),
    createdAt: stringValue(value.created_at),
    updatedAt: stringValue(value.updated_at),
  };
}

function parseTags(value: unknown): CustomerTag[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isObject).map(parseTag);
}

function parseTagListOrSingle(value: unknown): CustomerTag[] {
  if (Array.isArray(value) || (isObject(value) && Array.isArray(value.items))) {
    return parseList(value, parseTag);
  }

  if (isObject(value) && "id" in value) {
    return [parseTag(value)];
  }

  return [];
}

function parseCustomer(value: unknown): Customer {
  if (!isObject(value)) {
    throw new Error("Backend customer payload is invalid.");
  }

  const stats = isObject(value.stats) ? value.stats : {};

  return {
    id: stringValue(value.id),
    businessId: stringValue(value.business_id),
    customerCode: stringValue(value.customer_code, "Customer"),
    fullName: stringValue(value.full_name, "Unnamed customer"),
    phone: optionalString(value.phone),
    email: optionalString(value.email),
    dateOfBirth: optionalString(value.date_of_birth),
    gender: isCustomerGender(value.gender) ? value.gender : null,
    addressLine1: optionalString(value.address_line_1),
    addressLine2: optionalString(value.address_line_2),
    city: optionalString(value.city),
    state: optionalString(value.state),
    country: optionalString(value.country),
    postalCode: optionalString(value.postal_code),
    notes: optionalString(value.notes),
    status: isCustomerStatus(value.status) ? value.status : "active",
    tags: parseTags(value.tags),
    createdByUserId: optionalString(value.created_by_user_id),
    updatedByUserId: optionalString(value.updated_by_user_id),
    createdAt: stringValue(value.created_at),
    updatedAt: stringValue(value.updated_at),
    totalSalesAmount:
      typeof value.total_sales_amount === "number"
        ? value.total_sales_amount
        : typeof stats.total_sales_amount === "number"
          ? stats.total_sales_amount
          : null,
    totalOrdersCount:
      typeof value.total_orders_count === "number"
        ? value.total_orders_count
        : typeof stats.total_orders_count === "number"
          ? stats.total_orders_count
          : null,
    lastPurchaseAt: optionalString(value.last_purchase_at ?? stats.last_purchase_at),
  };
}

function parseNote(value: unknown): CustomerNote {
  if (!isObject(value)) {
    throw new Error("Backend customer note payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    businessId: stringValue(value.business_id),
    customerId: stringValue(value.customer_id),
    note: stringValue(value.note),
    createdByUserId: optionalString(value.created_by_user_id),
    createdByUserName: stringValue(value.created_by_user_name, "User"),
    createdAt: stringValue(value.created_at),
    updatedAt: stringValue(value.updated_at),
  };
}

function parseStats(value: unknown): CustomerStats {
  if (!isObject(value)) {
    throw new Error("Backend customer stats payload is invalid.");
  }

  return {
    totalSalesAmount: numberValue(value.total_sales_amount),
    posSalesAmount: numberValue(value.pos_sales_amount),
    posSalesCount: numberValue(value.pos_sales_count),
    bakeryOrdersAmount: numberValue(value.bakery_orders_amount),
    bakeryOrdersCount: numberValue(value.bakery_orders_count),
    totalPaidAmount: numberValue(value.total_paid_amount),
    totalRefundedAmount: numberValue(value.total_refunded_amount),
    netSpent: numberValue(value.net_spent),
    totalOrdersCount: numberValue(value.total_orders_count),
    lastPurchaseAt: optionalString(value.last_purchase_at),
    lastOrderAt: optionalString(value.last_order_at),
    outstandingBalance: numberValue(value.outstanding_balance),
    pendingPayments: numberValue(value.pending_payments),
    recentTransactions: parseTransactions(value.recent_transactions),
  };
}

function parseTransaction(value: unknown): CustomerTransaction {
  if (!isObject(value)) {
    throw new Error("Backend customer transaction payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    sourceType: isCustomerTransactionSource(value.source_type) ? value.source_type : "pos_sale",
    sourceId: stringValue(value.source_id),
    sourceNumber: stringValue(value.source_number),
    description: stringValue(value.description),
    amount: numberValue(value.amount),
    status: stringValue(value.status),
    paymentStatus: stringValue(value.payment_status),
    occurredAt: stringValue(value.occurred_at),
  };
}

function parseTransactions(value: unknown): CustomerTransaction[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(parseTransaction);
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

function customerPayload(
  payload: CreateCustomerPayload | UpdateCustomerPayload,
): BackendCustomerPayload {
  const nextPayload: BackendCustomerPayload = {};

  if (payload.fullName !== undefined) nextPayload.full_name = payload.fullName;
  if (payload.phone !== undefined) nextPayload.phone = payload.phone;
  if (payload.email !== undefined) nextPayload.email = payload.email;
  if (payload.dateOfBirth !== undefined) nextPayload.date_of_birth = payload.dateOfBirth;
  if (payload.gender !== undefined) nextPayload.gender = payload.gender;
  if (payload.addressLine1 !== undefined) nextPayload.address_line_1 = payload.addressLine1;
  if (payload.addressLine2 !== undefined) nextPayload.address_line_2 = payload.addressLine2;
  if (payload.city !== undefined) nextPayload.city = payload.city;
  if (payload.state !== undefined) nextPayload.state = payload.state;
  if (payload.country !== undefined) nextPayload.country = payload.country;
  if (payload.postalCode !== undefined) nextPayload.postal_code = payload.postalCode;
  if (payload.notes !== undefined) nextPayload.notes = payload.notes;
  if (payload.tagIds !== undefined) nextPayload.tag_ids = payload.tagIds;

  return nextPayload;
}

function quickCreatePayload(payload: QuickCreateCustomerPayload): BackendCustomerPayload {
  return {
    full_name: payload.fullName,
    phone: payload.phone ?? null,
    email: payload.email ?? null,
  };
}

function tagPayload(
  payload: CreateCustomerTagPayload | UpdateCustomerTagPayload,
): BackendCustomerTagPayload {
  const nextPayload: BackendCustomerTagPayload = {};

  if (payload.tagName !== undefined) nextPayload.tag_name = payload.tagName;
  if (payload.color !== undefined) nextPayload.color = payload.color;

  return nextPayload;
}

export async function getCustomers(params: CustomerFilters): Promise<Customer[]> {
  const response = await apiRequest<Customer[]>(
    `/api/v1/customers${toQueryString({
      search: params.search,
      status: params.status,
      tag_id: params.tagId,
      date_from: params.dateFrom,
      date_to: params.dateTo,
    })}`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseCustomer),
    },
  );

  return response.data;
}

export async function createCustomer(payload: CreateCustomerPayload): Promise<Customer> {
  const response = await apiRequest<Customer, BackendCustomerPayload>("/api/v1/customers", {
    method: "POST",
    authMode: "appwrite",
    body: customerPayload(payload),
    parse: parseCustomer,
  });

  return response.data;
}

export async function getCustomerById(id: string): Promise<Customer> {
  const response = await apiRequest<Customer>(`/api/v1/customers/${id}`, {
    authMode: "appwrite",
    parse: parseCustomer,
  });

  return response.data;
}

export async function updateCustomer(
  id: string,
  payload: UpdateCustomerPayload,
): Promise<Customer> {
  const response = await apiRequest<Customer, BackendCustomerPayload>(`/api/v1/customers/${id}`, {
    method: "PATCH",
    authMode: "appwrite",
    body: customerPayload(payload),
    parse: parseCustomer,
  });

  return response.data;
}

export async function updateCustomerStatus(
  id: string,
  payload: UpdateCustomerStatusPayload,
): Promise<Customer> {
  const response = await apiRequest<Customer, { status: CustomerStatus }>(
    `/api/v1/customers/${id}/status`,
    {
      method: "PATCH",
      authMode: "appwrite",
      body: payload,
      parse: parseCustomer,
    },
  );

  return response.data;
}

export async function deleteCustomer(id: string): Promise<void> {
  await apiRequest<void>(`/api/v1/customers/${id}`, {
    method: "DELETE",
    authMode: "appwrite",
    parse: () => undefined,
  });
}

export async function lookupCustomers(params: CustomerLookupParams): Promise<Customer[]> {
  const response = await apiRequest<Customer[]>(
    `/api/v1/customers/lookup${toQueryString({
      search: params.search,
      limit: params.limit ?? 10,
    })}`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseCustomer),
    },
  );

  return response.data;
}

export async function quickCreateCustomer(payload: QuickCreateCustomerPayload): Promise<Customer> {
  const response = await apiRequest<Customer, BackendCustomerPayload>(
    "/api/v1/customers/quick-create",
    {
      method: "POST",
      authMode: "appwrite",
      body: quickCreatePayload(payload),
      parse: parseCustomer,
    },
  );

  return response.data;
}

export async function getCustomerTags(): Promise<CustomerTag[]> {
  const response = await apiRequest<CustomerTag[]>("/api/v1/customers/tags", {
    authMode: "appwrite",
    parse: (data) => parseList(data, parseTag),
  });

  return response.data;
}

export async function createCustomerTag(payload: CreateCustomerTagPayload): Promise<CustomerTag> {
  const response = await apiRequest<CustomerTag, BackendCustomerTagPayload>(
    "/api/v1/customers/tags",
    {
      method: "POST",
      authMode: "appwrite",
      body: tagPayload(payload),
      parse: parseTag,
    },
  );

  return response.data;
}

export async function updateCustomerTag(
  id: string,
  payload: UpdateCustomerTagPayload,
): Promise<CustomerTag> {
  const response = await apiRequest<CustomerTag, BackendCustomerTagPayload>(
    `/api/v1/customers/tags/${id}`,
    {
      method: "PATCH",
      authMode: "appwrite",
      body: tagPayload(payload),
      parse: parseTag,
    },
  );

  return response.data;
}

export async function deleteCustomerTag(id: string): Promise<void> {
  await apiRequest<void>(`/api/v1/customers/tags/${id}`, {
    method: "DELETE",
    authMode: "appwrite",
    parse: () => undefined,
  });
}

export async function getCustomerAssignedTags(customerId: string): Promise<CustomerTag[]> {
  const response = await apiRequest<CustomerTag[]>(`/api/v1/customers/${customerId}/tags`, {
    authMode: "appwrite",
    parse: (data) => parseList(data, parseTag),
  });

  return response.data;
}

export async function assignCustomerTag(
  customerId: string,
  payload: AssignCustomerTagPayload,
): Promise<CustomerTag[]> {
  const response = await apiRequest<CustomerTag[], { tag_id: string }>(
    `/api/v1/customers/${customerId}/tags`,
    {
      method: "POST",
      authMode: "appwrite",
      body: { tag_id: payload.tagId },
      parse: parseTagListOrSingle,
    },
  );

  return response.data;
}

export async function removeCustomerTag(customerId: string, tagId: string): Promise<void> {
  await apiRequest<void>(`/api/v1/customers/${customerId}/tags/${tagId}`, {
    method: "DELETE",
    authMode: "appwrite",
    parse: () => undefined,
  });
}

export async function getCustomerNotes(customerId: string): Promise<CustomerNote[]> {
  const response = await apiRequest<CustomerNote[]>(`/api/v1/customers/${customerId}/notes`, {
    authMode: "appwrite",
    parse: (data) => parseList(data, parseNote),
  });

  return response.data;
}

export async function createCustomerNote(
  customerId: string,
  payload: CreateCustomerNotePayload,
): Promise<CustomerNote> {
  const response = await apiRequest<CustomerNote, { note: string }>(
    `/api/v1/customers/${customerId}/notes`,
    {
      method: "POST",
      authMode: "appwrite",
      body: payload,
      parse: parseNote,
    },
  );

  return response.data;
}

export async function deleteCustomerNote(customerId: string, noteId: string): Promise<void> {
  await apiRequest<void>(`/api/v1/customers/${customerId}/notes/${noteId}`, {
    method: "DELETE",
    authMode: "appwrite",
    parse: () => undefined,
  });
}

export async function getCustomerStats(customerId: string): Promise<CustomerStats> {
  const response = await apiRequest<CustomerStats>(`/api/v1/customers/${customerId}/stats`, {
    authMode: "appwrite",
    parse: parseStats,
  });

  return response.data;
}
