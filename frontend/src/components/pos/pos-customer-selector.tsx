import { Plus, X } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { CustomerStatusBadge } from "@/components/customers/customer-status-badge";
import { POSQuickCustomerDialog } from "@/components/pos/pos-quick-customer-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCustomerLookup, useQuickCreateCustomer } from "@/hooks/use-customers";
import { getErrorMessage } from "@/lib/api/client";
import type { Customer, QuickCreateCustomerPayload } from "@/types/customer";

type POSCustomerSelectorProps = {
  onChange: (customerId: string | null) => void;
  value: string | null;
};

export function POSCustomerSelector({ onChange, value }: POSCustomerSelectorProps): JSX.Element {
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const lookupQuery = useCustomerLookup(search, true);
  const quickCreateMutation = useQuickCreateCustomer();
  const results = lookupQuery.data ?? [];

  const selectCustomer = (customer: Customer): void => {
    setSelectedCustomer(customer);
    setSearch("");
    onChange(customer.id);
  };

  const quickCreate = async (payload: QuickCreateCustomerPayload): Promise<void> => {
    try {
      const customer = await quickCreateMutation.mutateAsync(payload);
      selectCustomer(customer);
      setQuickCreateOpen(false);
      toast.success("Customer selected.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="relative grid gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#71717a]">
          Customer
        </span>
        <Button
          className="h-6 rounded-md px-2 text-xs text-[#09090b] hover:bg-[#f4f4f5]"
          onClick={() => setQuickCreateOpen(true)}
          type="button"
          variant="ghost"
        >
          <Plus className="h-3 w-3" />
          New
        </Button>
      </div>
      {value && selectedCustomer ? (
        <div className="flex h-9 items-center justify-between rounded-md border border-[#d4d4d8] bg-white px-3 text-sm">
          <span>
            <span className="font-semibold text-[#09090b]">{selectedCustomer.fullName}</span>
            <span className="ml-2 text-[#71717a]">
              {selectedCustomer.phone ?? selectedCustomer.email}
            </span>
          </span>
          <Button
            aria-label="Clear selected customer"
            className="h-6 w-6"
            onClick={() => {
              setSelectedCustomer(null);
              onChange(null);
            }}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Input
          className="h-9 rounded-md border-[#d4d4d8] bg-white text-sm shadow-none focus-visible:ring-black"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Walk-in customer or search..."
          value={search}
        />
      )}
      {!value && search.trim().length >= 2 ? (
        <div className="scrollbar-hidden absolute left-0 right-0 top-full z-20 mt-2 max-h-56 overflow-y-auto rounded-md border border-[#d4d4d8] bg-white p-2 shadow-lg">
          {lookupQuery.isLoading ? (
            <p className="px-3 py-2 text-sm text-[#71717a]">Searching...</p>
          ) : null}
          {!lookupQuery.isLoading && results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-[#71717a]">No customers found.</p>
          ) : null}
          {results.map((customer) => {
            const isSelectable = customer.status === "active";

            return (
              <button
                className="block w-full rounded-md px-3 py-2 text-left text-sm transition hover:bg-[#f4f4f5] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!isSelectable}
                key={customer.id}
                onClick={() => selectCustomer(customer)}
                title={
                  isSelectable
                    ? `Select ${customer.fullName}`
                    : `${customer.status} customers cannot be selected for POS billing.`
                }
                type="button"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#09090b]">{customer.fullName}</span>
                  <CustomerStatusBadge status={customer.status} />
                </span>
                <span className="mt-1 block text-xs text-[#71717a]">
                  {customer.customerCode} · {customer.phone ?? customer.email ?? "No contact"}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      <POSQuickCustomerDialog
        isSubmitting={quickCreateMutation.isPending}
        onClose={() => setQuickCreateOpen(false)}
        onSubmit={quickCreate}
        open={quickCreateOpen}
      />
    </div>
  );
}
