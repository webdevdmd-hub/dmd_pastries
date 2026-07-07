import { redirect } from "next/navigation";

import { ROUTES } from "@/constants/routes";

export default function LegacyNewExpensePage(): never {
  redirect(`${ROUTES.expenses}/new`);
}
