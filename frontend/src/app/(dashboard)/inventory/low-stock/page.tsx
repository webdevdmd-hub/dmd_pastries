import { redirect } from "next/navigation";

import { inventoryTabRedirect } from "@/components/inventory/inventory-tabs";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * "Low stock" used to mean two different things: this standalone page and the
 * in-page tab. Now it means one -- the tab -- and this route redirects there.
 *
 * The two dashboard links point at the tab directly via ROUTES.inventoryLowStock,
 * so this exists for bookmarks and anything outside the app.
 */
export default async function LowStockPage({ searchParams }: PageProps): Promise<never> {
  redirect(inventoryTabRedirect("low_stock", await searchParams));
}
