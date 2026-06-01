export type SupplierStatus = "active" | "inactive" | "blocked";

export type SupplierContact = {
  id: string;
  businessId: string;
  supplierId: string;
  contactName: string;
  contactRole: string | null;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Supplier = {
  id: string;
  businessId: string;
  supplierCode: string;
  supplierName: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  taxNumber: string | null;
  notes: string | null;
  status: SupplierStatus;
  primaryContact: SupplierContact | null;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SupplierNote = {
  id: string;
  businessId: string;
  supplierId: string;
  note: string;
  createdByUserId: string | null;
  createdByUserName: string;
  createdAt: string;
  updatedAt: string;
};

export type SupplierStats = {
  totalPurchaseOrders: number;
  totalPurchaseAmount: number;
  lastPurchaseDate: string | null;
};

export type CreateSupplierPayload = {
  supplierName: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  taxNumber?: string | null;
  notes?: string | null;
};

export type UpdateSupplierPayload = Partial<CreateSupplierPayload>;

export type UpdateSupplierStatusPayload = {
  status: SupplierStatus;
};

export type CreateSupplierContactPayload = {
  contactName: string;
  contactRole?: string | null;
  phone?: string | null;
  email?: string | null;
  isPrimary: boolean;
  notes?: string | null;
};

export type UpdateSupplierContactPayload = Partial<CreateSupplierContactPayload>;

export type CreateSupplierNotePayload = {
  note: string;
};

export type SupplierFilters = {
  search: string;
  status: SupplierStatus | "all";
  country: string;
};

export type SupplierLookupParams = {
  search: string;
  limit?: number;
};

export type SuppliersListResponse = Supplier[];
