import type { Metadata } from "next";
import type { JSX } from "react";

import { ReceiptLayoutsPageClient } from "@/components/settings/receipt-layouts-page-client";

export const metadata: Metadata = {
  title: "Receipt Layouts",
};

export default function ReceiptLayoutsPage(): JSX.Element {
  return <ReceiptLayoutsPageClient />;
}
