import type { Metadata } from "next";
import type { JSX } from "react";

import { ReportsDashboardClient } from "@/components/reports/reports-dashboard-client";

export const metadata: Metadata = {
  title: "Reports Dashboard | Pastries POS",
};

export default function ReportsDashboardPage(): JSX.Element {
  return <ReportsDashboardClient />;
}
