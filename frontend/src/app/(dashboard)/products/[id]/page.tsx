import type { Metadata } from "next";
import type { JSX } from "react";

import { ProductDetailsPageClient } from "@/components/products/product-details-page-client";

export const metadata: Metadata = {
  title: "Product details",
};

type ProductDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProductDetailsPage({
  params,
}: ProductDetailsPageProps): Promise<JSX.Element> {
  const { id } = await params;

  return <ProductDetailsPageClient productId={id} />;
}
