import { redirect } from "next/navigation";

export default function SettingsUnitsLegacyPage(): never {
  redirect("/settings/master-data/units");
}
