import type { Metadata } from "next";
import type { JSX } from "react";

import { ReconciliationPageClient } from "@/components/payments/reconciliation-page-client";

export const metadata: Metadata = {
  title: "Payment Reconciliation",
};

export default function PaymentReconciliationPage(): JSX.Element {
  return <ReconciliationPageClient />;
}
