import { redirect } from "next/navigation";

import { ROUTES } from "@/constants/routes";

export default function PaymentAccountsPage(): never {
  redirect(`${ROUTES.settingsPaymentSetup}?tab=accounts`);
}
