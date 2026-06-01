import type { Metadata } from "next";
import type { JSX } from "react";

import { RefundsPageClient } from "@/components/payments/refunds-page-client";

export const metadata: Metadata = {
  title: "Payment Refunds",
};

export default function PaymentRefundsPage(): JSX.Element {
  return <RefundsPageClient />;
}
