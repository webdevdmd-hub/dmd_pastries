"use client";

import { CheckCircle2, Circle } from "lucide-react";
import type { JSX } from "react";

import type { OrderStatus } from "@/types/orders";

const steps: { label: string; status: OrderStatus }[] = [
  { label: "New", status: "new" },
  { label: "Confirmed", status: "confirmed" },
  { label: "In production", status: "in_production" },
  { label: "Ready", status: "ready" },
  { label: "Delivered", status: "delivered" },
  { label: "Completed", status: "completed" },
];

export function OrderTimeline({ status }: { status: OrderStatus }): JSX.Element {
  const activeIndex = steps.findIndex((step) => step.status === status);

  return (
    <section className="rounded-3xl border border-brand-cappuccino/60 bg-card/85 p-5">
      <h2 className="text-xl font-semibold text-brand-espresso">Order Timeline</h2>
      <div className="mt-5 grid gap-3">
        {steps.map((step, index) => {
          const isReached = activeIndex >= index && status !== "cancelled";
          return (
            <div className="flex items-center gap-3 text-sm" key={step.status}>
              {isReached ? (
                <CheckCircle2 className="h-5 w-5 text-money-text" />
              ) : (
                <Circle className="h-5 w-5 text-brand-mocha/60" />
              )}
              <span
                className={isReached ? "font-semibold text-brand-espresso" : "text-brand-mocha"}
              >
                {step.label}
              </span>
            </div>
          );
        })}
        {status === "cancelled" ? (
          <p className="text-sm font-semibold text-danger-text">Order cancelled.</p>
        ) : null}
      </div>
    </section>
  );
}
