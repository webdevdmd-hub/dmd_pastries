import type { JSX } from "react";

import { TableDensityToggle } from "@/components/density/table-density";
import { FilterBar } from "@/components/shared/filter-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PAYMENT_STATUS_LABELS,
  type PaymentFilters,
  type PaymentStatus,
  type RefundFilters,
} from "@/types/payment";
import type { PaymentMethod } from "@/types/settings";

type PaymentsToolbarProps =
  | {
      filters: PaymentFilters;
      mode?: "payments";
      onFiltersChange: (filters: PaymentFilters) => void;
      paymentMethods: PaymentMethod[];
    }
  | {
      filters: RefundFilters;
      mode: "refunds";
      onFiltersChange: (filters: RefundFilters) => void;
      paymentMethods: PaymentMethod[];
    };

// Only the statuses the backend can actually produce.
//
// The schema permits five (migration 000013), and this list offered all five,
// but sale_payments.payment_status is written as "completed" at both creation
// sites and only ever moved on by a refund. Nothing anywhere sets "pending" or
// "failed", so those two options matched zero rows forever — a user picking
// "Failed" got an empty table and reasonably concluded the data was broken.
//
// Restore them here when a payment flow can genuinely produce them; the badge
// tones for both already exist in payment-status-badge.tsx.
const paymentStatuses: (PaymentStatus | "all")[] = [
  "all",
  "completed",
  "partially_refunded",
  "refunded",
];

// Above this many options the segmented control stops being a glance and starts
// being a wall, so it falls back to the select. DESIGN.md §6 names the segmented
// control for payment method, but payment methods are tenant data — most
// bakeries run three or four, some run more.
const MAX_SEGMENTED_METHODS = 5;

function PaymentMethodSelect({
  onChange,
  paymentMethods,
  value,
}: {
  onChange: (value: string) => void;
  paymentMethods: PaymentMethod[];
  value: string;
}): JSX.Element {
  const options = [
    { label: "All", value: "all" },
    ...paymentMethods.map((method) => ({ label: method.methodName, value: method.id })),
  ];

  if (options.length <= MAX_SEGMENTED_METHODS) {
    return (
      <SegmentedControl
        aria-label="Payment method"
        onValueChange={onChange}
        options={options}
        value={value}
      />
    );
  }

  return (
    <Select onValueChange={onChange} value={value}>
      <SelectTrigger aria-label="Payment method">
        <SelectValue placeholder="Payment method" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All methods</SelectItem>
        {paymentMethods.map((method) => (
          <SelectItem key={method.id} value={method.id}>
            {method.methodName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PaymentsToolbar(props: PaymentsToolbarProps): JSX.Element {
  if (props.mode === "refunds") {
    const { filters, onFiltersChange, paymentMethods } = props;

    return (
      <FilterBar>
        <Input
          aria-label="Search refunds"
          onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
          className="min-w-52 flex-1"
          placeholder="Search refund"
          value={filters.search}
        />
        <PaymentMethodSelect
          onChange={(value) => onFiltersChange({ ...filters, paymentMethodId: value })}
          paymentMethods={paymentMethods}
          value={filters.paymentMethodId}
        />
        {/* No refund status control. payment_refunds.refund_status is only ever
            written as "completed" (payments/service.go), so the filter could
            never narrow anything. `filters.refundStatus` stays "all" and is
            still sent, so the query contract is unchanged. */}
        <Input
          aria-label="Date from"
          className="w-40"
          onChange={(event) => onFiltersChange({ ...filters, dateFrom: event.target.value })}
          type="date"
          value={filters.dateFrom}
        />
        <Input
          aria-label="Date to"
          className="w-40"
          onChange={(event) => onFiltersChange({ ...filters, dateTo: event.target.value })}
          type="date"
          value={filters.dateTo}
        />
        <Button
          onClick={() =>
            onFiltersChange({
              search: "",
              paymentMethodId: "all",
              refundStatus: "all",
              dateFrom: "",
              dateTo: "",
            })
          }
          type="button"
          variant="outline"
        >
          Reset
        </Button>
        <TableDensityToggle className="ml-auto" />
      </FilterBar>
    );
  }

  const { filters, onFiltersChange, paymentMethods } = props;

  return (
    <FilterBar>
      <Input
        aria-label="Search payments by sale, reference, or cashier"
        onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
        className="min-w-52 flex-1"
        placeholder="Search sale, reference, cashier"
        value={filters.search}
      />
      <PaymentMethodSelect
        onChange={(value) => onFiltersChange({ ...filters, paymentMethodId: value })}
        paymentMethods={paymentMethods}
        value={filters.paymentMethodId}
      />
      <Select
        onValueChange={(value) => {
          if (isPaymentFilterStatus(value)) {
            onFiltersChange({ ...filters, paymentStatus: value });
          }
        }}
        value={filters.paymentStatus}
      >
        <SelectTrigger aria-label="Payment status" className="w-44">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {paymentStatuses.map((status) => (
            <SelectItem key={status} value={status}>
              {status === "all" ? "All statuses" : PAYMENT_STATUS_LABELS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        aria-label="Date from"
        className="w-40"
        onChange={(event) => onFiltersChange({ ...filters, dateFrom: event.target.value })}
        type="date"
        value={filters.dateFrom}
      />
      <Input
        aria-label="Date to"
        className="w-40"
        onChange={(event) => onFiltersChange({ ...filters, dateTo: event.target.value })}
        type="date"
        value={filters.dateTo}
      />
      <Button
        onClick={() => onFiltersChange({ ...filters, ...defaultPaymentReset })}
        type="button"
        variant="outline"
      >
        Reset
      </Button>
      <TableDensityToggle className="ml-auto" />
    </FilterBar>
  );
}

const defaultPaymentReset = {
  search: "",
  paymentMethodId: "all",
  paymentStatus: "all",
  dateFrom: "",
  dateTo: "",
} satisfies Partial<PaymentFilters>;

function isPaymentFilterStatus(value: string): value is PaymentStatus | "all" {
  return paymentStatuses.some((status) => status === value);
}
