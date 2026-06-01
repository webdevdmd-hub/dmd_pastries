"use client";

import { Plus, Search } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { OrderQuickCustomerDialog } from "@/components/orders/order-quick-customer-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCustomerLookup, useQuickCreateCustomer } from "@/hooks/use-customers";
import type { Customer } from "@/types/customer";

export function OrderCustomerSelector({
  customerId,
  customerName,
  customerPhone,
  onCustomerChange,
}: {
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  onCustomerChange: (customer: {
    id: string | null;
    name: string | null;
    phone: string | null;
  }) => void;
}): JSX.Element {
  const [search, setSearch] = useState("");
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const lookupQuery = useCustomerLookup(search, search.trim().length >= 2);
  const quickCreateMutation = useQuickCreateCustomer();

  const selectCustomer = (customer: Customer): void => {
    if (customer.status !== "active") {
      toast.error("Only active customers can be selected for orders.");
      return;
    }

    onCustomerChange({ id: customer.id, name: customer.fullName, phone: customer.phone });
    setSearch("");
  };

  return (
    <section className="rounded-3xl border border-brand-cappuccino/60 bg-white/85 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-brand-espresso">Customer</h2>
          <p className="text-sm text-brand-mocha">Search existing customers or create quickly.</p>
        </div>
        <Button onClick={() => setQuickCreateOpen(true)} type="button" variant="outline">
          <Plus className="h-4 w-4" />
          Create
        </Button>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-brand-mocha" />
        <Input
          className="pl-9"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search customer name, phone, email..."
          value={search}
        />
        {search.trim().length >= 2 ? (
          <div className="scrollbar-hidden absolute left-0 right-0 top-full z-20 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-brand-cappuccino bg-white p-2 shadow-float">
            {lookupQuery.isLoading ? (
              <p className="p-3 text-sm text-brand-mocha">Searching...</p>
            ) : null}
            {!lookupQuery.isLoading && (lookupQuery.data ?? []).length === 0 ? (
              <p className="p-3 text-sm text-brand-mocha">No customers found.</p>
            ) : null}
            {(lookupQuery.data ?? []).map((customer) => (
              <button
                className="flex w-full items-center justify-between rounded-xl p-3 text-left text-sm hover:bg-brand-latte"
                key={customer.id}
                onClick={() => selectCustomer(customer)}
                type="button"
              >
                <span>
                  <span className="block font-semibold text-brand-espresso">
                    {customer.fullName}
                  </span>
                  <span className="text-xs text-brand-mocha">
                    {customer.phone ?? customer.email ?? customer.customerCode}
                  </span>
                </span>
                <span className="text-xs capitalize text-brand-mocha">{customer.status}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="mt-4 rounded-2xl bg-brand-latte/70 p-4 text-sm text-brand-mocha">
        <p className="font-semibold text-brand-espresso">{customerName ?? "Walk-in customer"}</p>
        <p>{customerPhone ?? (customerId ? "Selected customer" : "No customer selected")}</p>
        {customerId ? (
          <Button
            className="mt-3"
            onClick={() => onCustomerChange({ id: null, name: null, phone: null })}
            size="sm"
            type="button"
            variant="outline"
          >
            Clear customer
          </Button>
        ) : null}
      </div>
      <OrderQuickCustomerDialog
        isSubmitting={quickCreateMutation.isPending}
        onClose={() => setQuickCreateOpen(false)}
        onSubmit={async (payload) => {
          const customer = await quickCreateMutation.mutateAsync(payload);
          onCustomerChange({ id: customer.id, name: customer.fullName, phone: customer.phone });
          setQuickCreateOpen(false);
          toast.success("Customer selected.");
          return customer;
        }}
        open={quickCreateOpen}
      />
    </section>
  );
}
