import { apiRequest } from "@/lib/api/client";

export type CustomerCredit = {
  id: string;
  customerId: string;
  sourceType: "sales_return" | "bakery_order" | "manual";
  sourceId: string | null;
  journalEntryId: string | null;
  amount: number;
  balance: number;
  notes: string;
  createdAt: string;
};

export type CustomerCreditsResponse = {
  items: CustomerCredit[];
  balance: number;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numberValue(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseCredit(value: unknown): CustomerCredit {
  const row = isObject(value) ? value : {};
  const sourceType = stringValue(row.source_type);
  return {
    id: stringValue(row.id),
    customerId: stringValue(row.customer_id),
    sourceType:
      sourceType === "sales_return" || sourceType === "bakery_order" ? sourceType : "manual",
    sourceId: nullableString(row.source_id),
    journalEntryId: nullableString(row.journal_entry_id),
    amount: numberValue(row.amount),
    balance: numberValue(row.balance),
    notes: stringValue(row.notes),
    createdAt: stringValue(row.created_at),
  };
}

export async function getCustomerCredits(customerId: string): Promise<CustomerCreditsResponse> {
  const response = await apiRequest<CustomerCreditsResponse>(
    `/api/v1/accounting/customer-credits?customer_id=${encodeURIComponent(customerId)}`,
    {
      authMode: "appwrite",
      method: "GET",
      parse: (value: unknown) => {
        const payload = isObject(value) ? value : {};
        const items = Array.isArray(payload.items) ? payload.items.map(parseCredit) : [];
        return { items, balance: numberValue(payload.balance) };
      },
    },
  );

  return response.data;
}
