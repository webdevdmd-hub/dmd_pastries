import type { JSX } from "react";

import { ExpensesPageClient } from "@/components/purchasing/expenses-page-client";

export default function NewExpensePage(): JSX.Element {
  return <ExpensesPageClient initialCreateOpen redirectOnCreateClose />;
}
