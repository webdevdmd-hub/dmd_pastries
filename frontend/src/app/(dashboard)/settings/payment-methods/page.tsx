import { redirect } from "next/navigation";

import { ROUTES } from "@/constants/routes";

export default function PaymentMethodsSettingsPage(): never {
  redirect(`${ROUTES.settingsPaymentSetup}?tab=methods`);
}
