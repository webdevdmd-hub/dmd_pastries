import type { JSX } from "react";

import { SettingsDataPageClient } from "@/components/settings/settings-data-page-client";

export default function CompanyProfileSettingsPage(): JSX.Element {
  return <SettingsDataPageClient kind="company" />;
}
