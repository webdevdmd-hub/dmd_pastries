import { redirect } from "next/navigation";
import type { JSX } from "react";

import { ExpenseDetailsPageClient } from "@/components/purchasing/expense-details-page-client";
import { ROUTES } from "@/constants/routes";

type ExpenseDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ExpenseDetailsPage({
  params,
}: ExpenseDetailsPageProps): Promise<JSX.Element> {
  const resolvedParams = await params;

  if (resolvedParams.id === "new") {
    redirect(`${ROUTES.expenses}/new`);
  }

  return <ExpenseDetailsPageClient expenseId={resolvedParams.id} />;
}
