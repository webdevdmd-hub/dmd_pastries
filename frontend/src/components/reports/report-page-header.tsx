import type { JSX, ReactNode } from "react";

import { PageHeader } from "@/components/shared/page-header";

type ReportPageHeaderProps = {
  actions?: ReactNode;
  description: string;
  title: string;
};

export function ReportPageHeader({
  actions,
  description,
  title,
}: ReportPageHeaderProps): JSX.Element {
  return <PageHeader title={title} description={description} actions={actions} />;
}
