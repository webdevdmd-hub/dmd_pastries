import type { Metadata } from "next";
import type { JSX } from "react";

import { ReportsExportClient } from "@/components/reports/reports-export-client";

export const metadata: Metadata = {
  title: "Export Center | Pastries POS",
};

export default function ReportsExportPage(): JSX.Element {
  return <ReportsExportClient />;
}
