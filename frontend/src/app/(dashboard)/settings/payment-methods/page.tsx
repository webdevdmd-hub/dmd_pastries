import type { JSX } from "react";

import { SettingsDataPageClient } from "@/components/settings/settings-data-page-client";

export default function PaymentMethodsSettingsPage(): JSX.Element {
  return <SettingsDataPageClient kind="payment-methods" />;
}
