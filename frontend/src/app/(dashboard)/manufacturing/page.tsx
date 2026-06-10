import { redirect } from "next/navigation";
import type { JSX } from "react";

import { ROUTES } from "@/constants/routes";

export default function ManufacturingPage(): JSX.Element {
  redirect(ROUTES.manufacturingBatches);
}
