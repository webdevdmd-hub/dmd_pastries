import type { JSX, ReactNode } from "react";

import { ReportAreaLayout } from "@/components/reports/report-area-layout";

export default function Layout({ children }: { children: ReactNode }): JSX.Element {
  return <ReportAreaLayout area="sales">{children}</ReportAreaLayout>;
}
