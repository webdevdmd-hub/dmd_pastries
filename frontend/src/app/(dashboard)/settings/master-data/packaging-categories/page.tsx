import { redirect } from "next/navigation";

export default function PackagingCategoriesPage(): never {
  redirect("/settings/master-data/product-categories?product_type=packaging");
}
