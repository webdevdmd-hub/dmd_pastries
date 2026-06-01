import type { JSX } from "react";

import { SettingsDataPageClient } from "@/components/settings/settings-data-page-client";

export default function TaxRatesSettingsPage(): JSX.Element {
  return <SettingsDataPageClient kind="tax-rates" />;
}
