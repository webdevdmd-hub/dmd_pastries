import { redirect } from "next/navigation";

import { inventoryTabRedirect } from "@/components/inventory/inventory-tabs";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Now the "By location" tab on /inventory. Kept so bookmarks keep working. */
export default async function LocationBalancesPage({ searchParams }: PageProps): Promise<never> {
  redirect(inventoryTabRedirect("locations", await searchParams));
}
