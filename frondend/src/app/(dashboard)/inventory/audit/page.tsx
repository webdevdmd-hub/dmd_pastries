import { redirect } from "next/navigation";

import { ROUTES } from "@/constants/routes";

export default function InventoryAuditIndexPage(): never {
  redirect(ROUTES.reportsInventoryAudit);
}
