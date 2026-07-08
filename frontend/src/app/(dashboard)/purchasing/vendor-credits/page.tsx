import { redirect } from "next/navigation";

import { ROUTES } from "@/constants/routes";

export default function VendorCreditsLegacyPage(): never {
  redirect(ROUTES.purchasingReturns);
}
