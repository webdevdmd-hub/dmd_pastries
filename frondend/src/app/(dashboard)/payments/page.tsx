import type { Metadata } from "next";
import type { JSX } from "react";

import { PaymentsPageClient } from "@/components/payments/payments-page-client";

export const metadata: Metadata = {
  title: "Payments",
};

export default function PaymentsPage(): JSX.Element {
  return <PaymentsPageClient />;
}
