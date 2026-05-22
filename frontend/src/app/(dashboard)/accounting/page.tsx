import { redirect } from "next/navigation";

import { ROUTES } from "@/constants/routes";

export default function AccountingPage(): never {
  redirect(ROUTES.accountingJournalEntries);
}
