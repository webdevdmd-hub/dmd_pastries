import { redirect } from "next/navigation";

import { inventoryTabRedirect } from "@/components/inventory/inventory-tabs";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Movements is a tab on /inventory now, not a page of its own. This route
 * stays so bookmarks and the `?item=` deep link keep working -- both are
 * carried across into the tab URL.
 */
export default async function InventoryMovementsPage({ searchParams }: PageProps): Promise<never> {
  redirect(inventoryTabRedirect("movements", await searchParams));
}
