import type { Metadata } from "next";
import type { JSX } from "react";

import { ManufacturingReportsPageClient } from "@/components/reports/manufacturing/manufacturing-reports-page-client";

export const metadata: Metadata = { title: "Manufacturing Reports | Pastries POS" };

export default function ManufacturingReportsPage(): JSX.Element {
  return <ManufacturingReportsPageClient />;
}
