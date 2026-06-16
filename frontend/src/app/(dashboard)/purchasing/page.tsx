import { redirect } from "next/navigation";

import { ROUTES } from "@/constants/routes";

export default function PurchasingPage(): never {
  redirect(ROUTES.purchasingOrders);
}
