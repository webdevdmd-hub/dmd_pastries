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
import { useCustomerCredits } from "@/hooks/use-customer-credits";
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
  // W4: surface the selected customer's store-credit balance at the till.
  const creditsQuery = useCustomerCredits(value);
  const creditBalance = creditsQuery.data?.balance ?? 0;
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
    <div className="grid h-full min-w-0 grid-rows-[24px_36px] gap-1">
      <div className="flex h-6 items-center justify-between gap-2">
        <span className="text-meta flex items-center gap-2 text-foreground-muted">
          Customer
          {value && creditBalance > 0 ? (
            <span className="text-meta rounded-full bg-money-tint px-2 py-0.5 font-medium tabular-nums text-money-text">
              Credit{" "}
              {new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(
                creditBalance,
              )}
            </span>
          ) : null}
        </span>
        <Button
          className="text-meta h-6 rounded px-2 text-foreground hover:bg-muted"
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
        contentClassName="rounded-md border-border bg-card"
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
        showSelectedDescription={false}
        triggerClassName="h-9 min-h-9 rounded-md border-border bg-card text-sm shadow-none hover:bg-muted focus-visible:ring-black"
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
