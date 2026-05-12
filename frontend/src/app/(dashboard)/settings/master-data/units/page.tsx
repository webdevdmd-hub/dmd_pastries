import type { JSX } from "react";

import { MasterDataPageClient } from "@/components/master-data/master-data-page-client";

export default function UnitsPage(): JSX.Element {
  return <MasterDataPageClient collection="units" />;
}
