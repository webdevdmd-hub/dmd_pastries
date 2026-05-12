import type { JSX } from "react";

import { MasterDataPageClient } from "@/components/master-data/master-data-page-client";

export default function SupplierCategoriesPage(): JSX.Element {
  return <MasterDataPageClient collection="supplier-categories" />;
}
