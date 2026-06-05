import { Plus } from "lucide-react";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { POSQuickCustomerDialog } from "@/components/pos/pos-quick-customer-dialog";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/shared/searchable-select";
import { Button } from "@/components/ui/button";
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
  const results = useMemo(() => lookupQuery.data ?? [], [lookupQuery.data]);
  const customerOptions = useMemo<SearchableSelectOption[]>(() => {
    const optionMap = new Map<string, SearchableSelectOption>();

    if (selectedCustomer) {
      optionMap.set(selectedCustomer.id, {
        description: selectedCustomer.phone ?? selectedCustomer.email ?? "No contact",
        keywords: [
          selectedCustomer.customerCode,
          selectedCustomer.phone ?? "",
          selectedCustomer.email ?? "",
        ],
        label: selectedCustomer.fullName,
        meta: selectedCustomer.customerCode,
        value: selectedCustomer.id,
      });
    }

    results.forEach((customer) => {
      const contact = customer.phone ?? customer.email ?? "No contact";
      optionMap.set(customer.id, {
        description: `${contact} - ${customer.status}`,
        disabled: customer.status !== "active",
        keywords: [customer.customerCode, customer.phone ?? "", customer.email ?? ""],
        label: customer.fullName,
        meta: customer.customerCode,
        value: customer.id,
      });
    });

    return Array.from(optionMap.values());
  }, [results, selectedCustomer]);

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
    <div className="grid gap-1">
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

      <SearchableSelect
        ariaLabel="Select POS customer"
        contentClassName="rounded-md border-[#d4d4d8] bg-white"
        emptyMessage={
          search.trim().length < 2
            ? "Type at least 2 characters to search customers."
            : "No customers found."
        }
        loading={search.trim().length >= 2 && lookupQuery.isLoading}
        loadingMessage="Searching customers..."
        onSearchChange={setSearch}
        onValueChange={(nextCustomerId) => {
          if (!nextCustomerId) {
            setSelectedCustomer(null);
            onChange(null);
            return;
          }

          const customer =
            results.find((result) => result.id === nextCustomerId) ??
            (selectedCustomer?.id === nextCustomerId ? selectedCustomer : null);

          if (customer) {
            selectCustomer(customer);
          }
        }}
        options={customerOptions}
        placeholder="Walk-in customer or search..."
        searchPlaceholder="Search by name, code, phone, or email..."
        searchValue={search}
        triggerClassName="min-h-9 rounded-md border-[#d4d4d8] bg-white text-sm shadow-none hover:bg-[#fafafa] focus-visible:ring-black"
        value={value}
      />

      <POSQuickCustomerDialog
        isSubmitting={quickCreateMutation.isPending}
        onClose={() => setQuickCreateOpen(false)}
        onSubmit={quickCreate}
        open={quickCreateOpen}
      />
    </div>
  );
}
