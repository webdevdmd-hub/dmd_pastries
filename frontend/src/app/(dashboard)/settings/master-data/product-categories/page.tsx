import type { JSX } from "react";

import { MasterDataPageClient } from "@/components/master-data/master-data-page-client";

export default function ProductCategoriesPage(): JSX.Element {
  return <MasterDataPageClient collection="product-categories" />;
}
