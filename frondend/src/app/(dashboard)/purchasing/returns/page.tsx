import type { Metadata } from "next";
import type { JSX } from "react";

import { PurchaseReturnsPageClient } from "@/components/purchasing/purchase-returns-page-client";

export const metadata: Metadata = {
  title: "Purchase Returns | Pastries POS",
};

export default function PurchaseReturnsPage(): JSX.Element {
  return <PurchaseReturnsPageClient />;
}
