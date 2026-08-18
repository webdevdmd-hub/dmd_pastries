import type { Metadata } from "next";
import type { JSX } from "react";

import { SalesReturnsPageClient } from "@/components/payments/sales-returns-page-client";

export const metadata: Metadata = {
  title: "Returns / Credit Notes",
};

export default function PaymentReturnsPage(): JSX.Element {
  return <SalesReturnsPageClient />;
}
