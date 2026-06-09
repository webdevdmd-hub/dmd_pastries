import { redirect } from "next/navigation";

export default function IngredientCategoriesPage(): never {
  redirect("/settings/master-data/product-categories?product_type=ingredient");
}
