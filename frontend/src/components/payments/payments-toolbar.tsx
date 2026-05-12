import type { JSX, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PaymentFilters, PaymentStatus, RefundFilters, RefundStatus } from "@/types/payment";
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

const paymentStatuses: (PaymentStatus | "all")[] = [
  "all",
  "pending",
  "completed",
  "failed",
  "refunded",
  "partially_refunded",
];

const refundStatuses: (RefundStatus | "all")[] = [
  "all",
  "pending",
  "completed",
  "failed",
  "cancelled",
];

function PaymentMethodSelect({
  onChange,
  paymentMethods,
  value,
}: {
  onChange: (value: string) => void;
  paymentMethods: PaymentMethod[];
  value: string;
}): JSX.Element {
  return (
    <Select onValueChange={onChange} value={value}>
      <SelectTrigger className="rounded-2xl">
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

function ToolbarFrame({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="grid gap-3 rounded-3xl border border-brand-cappuccino/70 bg-white/75 p-4 shadow-sm lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto]">
      {children}
    </div>
  );
}

export function PaymentsToolbar(props: PaymentsToolbarProps): JSX.Element {
  if (props.mode === "refunds") {
    const { filters, onFiltersChange, paymentMethods } = props;

    return (
      <ToolbarFrame>
        <Input
          className="rounded-2xl"
          onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
          placeholder="Search refund"
          value={filters.search}
        />
        <PaymentMethodSelect
          onChange={(value) => onFiltersChange({ ...filters, paymentMethodId: value })}
          paymentMethods={paymentMethods}
          value={filters.paymentMethodId}
        />
        <Select
          onValueChange={(value) => {
            if (isRefundFilterStatus(value)) {
              onFiltersChange({ ...filters, refundStatus: value });
            }
          }}
          value={filters.refundStatus}
        >
          <SelectTrigger className="rounded-2xl">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {refundStatuses.map((status) => (
              <SelectItem key={status} value={status}>
                {status.replaceAll("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          aria-label="Date from"
          className="rounded-2xl"
          onChange={(event) => onFiltersChange({ ...filters, dateFrom: event.target.value })}
          type="date"
          value={filters.dateFrom}
        />
        <Input
          aria-label="Date to"
          className="rounded-2xl"
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
      </ToolbarFrame>
    );
  }

  const { filters, onFiltersChange, paymentMethods } = props;

  return (
    <ToolbarFrame>
      <Input
        className="rounded-2xl"
        onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
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
        <SelectTrigger className="rounded-2xl">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {paymentStatuses.map((status) => (
            <SelectItem key={status} value={status}>
              {status.replaceAll("_", " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        aria-label="Date from"
        className="rounded-2xl"
        onChange={(event) => onFiltersChange({ ...filters, dateFrom: event.target.value })}
        type="date"
        value={filters.dateFrom}
      />
      <Input
        aria-label="Date to"
        className="rounded-2xl"
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
    </ToolbarFrame>
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

function isRefundFilterStatus(value: string): value is RefundStatus | "all" {
  return refundStatuses.some((status) => status === value);
}
