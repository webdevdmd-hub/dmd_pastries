import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = {
  title: "Sales Receipts",
};

export default function ReceiptsReportPage() {
  redirect(ROUTES.payments);
}
