import type { Metadata } from "next";
import type { JSX } from "react";

import { ReportsPageClient } from "@/components/reports/reports-page-client";

export const metadata: Metadata = {
  title: "Reports | Pastries POS",
};

export default function ReportsPage(): JSX.Element {
  return <ReportsPageClient />;
}
