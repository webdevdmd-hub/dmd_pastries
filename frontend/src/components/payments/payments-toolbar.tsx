"use client";

import type { JSX } from "react";

import { FilterField, FilterToolbar } from "@/components/shared/filter-toolbar";
import { Input } from "@/components/ui/input";
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
// The schema permits five (migration 000013), but sale_payments.payment_status
// is written as "completed" at both creation sites and only ever moved on by a
// refund. Nothing anywhere sets "pending" or "failed", so those two options
// matched zero rows forever. Restore them here when a payment flow can
// genuinely produce them.
const paymentStatuses: (PaymentStatus | "all")[] = [
  "all",
  "completed",
  "partially_refunded",
  "refunded",
];

function isPaymentFilterStatus(value: string): value is PaymentStatus | "all" {
  return paymentStatuses.some((status) => status === value);
}

function PaymentMethodField({
  id,
  onChange,
  paymentMethods,
  value,
}: {
  id: string;
  onChange: (value: string) => void;
  paymentMethods: PaymentMethod[];
  value: string;
}): JSX.Element {
  return (
    <FilterField htmlFor={id} label="Payment method">
      <Select onValueChange={onChange} value={value}>
        <SelectTrigger id={id}>
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
    </FilterField>
  );
}

function DateRangeFields({
  dateFrom,
  dateTo,
  idPrefix,
  onChange,
}: {
  dateFrom: string;
  dateTo: string;
  idPrefix: string;
  onChange: (patch: { dateFrom?: string; dateTo?: string }) => void;
}): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-3">
      <FilterField htmlFor={`${idPrefix}DateFrom`} label="From">
        <Input
          id={`${idPrefix}DateFrom`}
          onChange={(event) => onChange({ dateFrom: event.target.value })}
          type="date"
          value={dateFrom}
        />
      </FilterField>
      <FilterField htmlFor={`${idPrefix}DateTo`} label="To">
        <Input
          id={`${idPrefix}DateTo`}
          onChange={(event) => onChange({ dateTo: event.target.value })}
          type="date"
          value={dateTo}
        />
      </FilterField>
    </div>
  );
}

/**
 * Search stays in the toolbar; method, status and the date range live in the
 * Filters popover, the same idiom as the orders and customers lists. Branch is
 * scope, not a filter: it is always set, so it never counts toward the badge
 * and Reset leaves it alone.
 */
export function PaymentsToolbar(props: PaymentsToolbarProps): JSX.Element {
  if (props.mode === "refunds") {
    const { filters, onFiltersChange, paymentMethods } = props;
    const hiddenFilterCount =
      (filters.paymentMethodId !== "all" ? 1 : 0) +
      (filters.dateFrom.length > 0 ? 1 : 0) +
      (filters.dateTo.length > 0 ? 1 : 0);

    return (
      <FilterToolbar
        hasAnyFilter={hiddenFilterCount > 0 || filters.search.trim().length > 0}
        hiddenFilterCount={hiddenFilterCount}
        hideDensityBelowMd
        onReset={() =>
          onFiltersChange({
            search: "",
            paymentMethodId: "all",
            refundStatus: "all",
            dateFrom: "",
            dateTo: "",
          })
        }
        onSearchChange={(search) => onFiltersChange({ ...filters, search })}
        popoverTitle="Filter refunds"
        searchAriaLabel="Search refunds"
        searchPlaceholder="Search refund or sale number..."
        searchValue={filters.search}
      >
        <PaymentMethodField
          id="refundsFilterMethod"
          onChange={(paymentMethodId) => onFiltersChange({ ...filters, paymentMethodId })}
          paymentMethods={paymentMethods}
          value={filters.paymentMethodId}
        />
        {/* No refund status control: payment_refunds.refund_status is only
            ever written as "completed", so the filter could never narrow
            anything. `filters.refundStatus` stays "all" and is still sent. */}
        <DateRangeFields
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
          idPrefix="refundsFilter"
          onChange={(patch) => onFiltersChange({ ...filters, ...patch })}
        />
      </FilterToolbar>
    );
  }

  const { filters, onFiltersChange, paymentMethods } = props;
  const hiddenFilterCount =
    (filters.paymentMethodId !== "all" ? 1 : 0) +
    (filters.paymentStatus !== "all" ? 1 : 0) +
    (filters.dateFrom.length > 0 ? 1 : 0) +
    (filters.dateTo.length > 0 ? 1 : 0);

  return (
    <FilterToolbar
      hasAnyFilter={hiddenFilterCount > 0 || filters.search.trim().length > 0}
      hiddenFilterCount={hiddenFilterCount}
      hideDensityBelowMd
      onReset={() =>
        onFiltersChange({
          ...filters,
          search: "",
          paymentMethodId: "all",
          paymentStatus: "all",
          dateFrom: "",
          dateTo: "",
        })
      }
      onSearchChange={(search) => onFiltersChange({ ...filters, search })}
      popoverTitle="Filter payments"
      searchAriaLabel="Search payments by sale, reference, or cashier"
      searchPlaceholder="Search sale, reference, cashier..."
      searchValue={filters.search}
    >
      <PaymentMethodField
        id="paymentsFilterMethod"
        onChange={(paymentMethodId) => onFiltersChange({ ...filters, paymentMethodId })}
        paymentMethods={paymentMethods}
        value={filters.paymentMethodId}
      />
      <FilterField htmlFor="paymentsFilterStatus" label="Status">
        <Select
          onValueChange={(value) => {
            if (isPaymentFilterStatus(value)) {
              onFiltersChange({ ...filters, paymentStatus: value });
            }
          }}
          value={filters.paymentStatus}
        >
          <SelectTrigger id="paymentsFilterStatus">
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
      </FilterField>
      <DateRangeFields
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
        idPrefix="paymentsFilter"
        onChange={(patch) => onFiltersChange({ ...filters, ...patch })}
      />
    </FilterToolbar>
  );
}
