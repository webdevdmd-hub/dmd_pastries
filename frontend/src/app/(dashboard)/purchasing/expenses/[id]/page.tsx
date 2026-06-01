import { redirect } from "next/navigation";

import { ROUTES } from "@/constants/routes";

type ExpenseDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function LegacyPurchasingExpenseDetailsPage({
  params,
}: ExpenseDetailsPageProps): Promise<never> {
  const resolvedParams = await params;

  redirect(`${ROUTES.expenses}/${resolvedParams.id}`);
}
