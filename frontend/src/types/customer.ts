export type CustomerStatus = "active" | "inactive" | "blocked";

export type CustomerGender = "male" | "female" | "other" | "prefer_not_to_say";

export type CustomerTag = {
  id: string;
  businessId: string;
  tagName: string;
  color: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Customer = {
  id: string;
  businessId: string;
  customerCode: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  dateOfBirth: string | null;
  gender: CustomerGender | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  notes: string | null;
  status: CustomerStatus;
  tags: CustomerTag[];
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  totalSalesAmount: number | null;
  totalOrdersCount: number | null;
  lastPurchaseAt: string | null;
};

export type CustomerNote = {
  id: string;
  businessId: string;
  customerId: string;
  note: string;
  createdByUserId: string | null;
  createdByUserName: string;
  createdAt: string;
  updatedAt: string;
};

export type CustomerStats = {
  totalSalesAmount: number;
  posSalesAmount: number;
  posSalesCount: number;
  bakeryOrdersAmount: number;
  bakeryOrdersCount: number;
  totalPaidAmount: number;
  totalRefundedAmount: number;
  netSpent: number;
  totalOrdersCount: number;
  lastPurchaseAt: string | null;
  lastOrderAt: string | null;
  outstandingBalance: number;
  pendingPayments: number;
  recentTransactions: CustomerTransaction[];
};

export type CustomerTransactionSource =
  | "pos_sale"
  | "bakery_order"
  | "pos_payment"
  | "bakery_payment"
  | "refund"
  | "sale_refund";

export type CustomerTransaction = {
  id: string;
  sourceType: CustomerTransactionSource;
  sourceId: string;
  sourceNumber: string;
  description: string;
  amount: number;
  status: string;
  paymentStatus: string;
  occurredAt: string;
};

export type CreateCustomerPayload = {
  fullName: string;
  phone?: string | null;
  email?: string | null;
  dateOfBirth?: string | null;
  gender?: CustomerGender | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  notes?: string | null;
  tagIds?: string[];
};

export type UpdateCustomerPayload = Partial<CreateCustomerPayload>;

export type UpdateCustomerStatusPayload = {
  status: CustomerStatus;
};

export type QuickCreateCustomerPayload = {
  fullName: string;
  phone?: string | null;
  email?: string | null;
};

export type CreateCustomerTagPayload = {
  tagName: string;
  color?: string | null;
};

export type UpdateCustomerTagPayload = Partial<CreateCustomerTagPayload>;

export type AssignCustomerTagPayload = {
  tagId: string;
};

export type CreateCustomerNotePayload = {
  note: string;
};

export type CustomerFilters = {
  search: string;
  status: CustomerStatus | "all";
  tagId: string;
  dateFrom: string;
  dateTo: string;
};

export type CustomerLookupParams = {
  search: string;
  limit?: number;
};

export type CustomersListResponse = Customer[];
