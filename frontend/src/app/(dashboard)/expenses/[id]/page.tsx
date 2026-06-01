import type { JSX } from "react";

import { ExpenseDetailsPageClient } from "@/components/purchasing/expense-details-page-client";

type ExpenseDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ExpenseDetailsPage({
  params,
}: ExpenseDetailsPageProps): Promise<JSX.Element> {
  const resolvedParams = await params;

  return <ExpenseDetailsPageClient expenseId={resolvedParams.id} />;
}
