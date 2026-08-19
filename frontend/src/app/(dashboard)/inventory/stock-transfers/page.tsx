import { redirect } from "next/navigation";

import { inventoryTabRedirect } from "@/components/inventory/inventory-tabs";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Now the "Transfers" tab on /inventory. Kept so bookmarks keep working. */
export default async function StockTransfersPage({ searchParams }: PageProps): Promise<never> {
  redirect(inventoryTabRedirect("transfers", await searchParams));
}
