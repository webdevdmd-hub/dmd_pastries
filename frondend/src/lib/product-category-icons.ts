import type { LucideIcon } from "lucide-react";
import {
  Apple,
  Banana,
  Bean,
  Beef,
  CakeSlice,
  Candy,
  CandyCane,
  Carrot,
  ChefHat,
  Cherry,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Donut,
  Drumstick,
  Fish,
  GlassWater,
  Grape,
  Ham,
  Hamburger,
  IceCreamBowl,
  IceCreamCone,
  Milk,
  Package,
  Pizza,
  Popcorn,
  Salad,
  Sandwich,
  ShoppingBag,
  ShoppingBasket,
  Soup,
  Utensils,
  Vegan,
  Wheat,
  Wine,
} from "lucide-react";

export type ProductCategoryIconKey =
  | "apple"
  | "banana"
  | "bean"
  | "beef"
  | "cake-slice"
  | "candy"
  | "candy-cane"
  | "carrot"
  | "chef-hat"
  | "cherry"
  | "coffee"
  | "cookie"
  | "croissant"
  | "cup-soda"
  | "donut"
  | "drumstick"
  | "fish"
  | "glass-water"
  | "grape"
  | "ham"
  | "hamburger"
  | "ice-cream-bowl"
  | "ice-cream-cone"
  | "milk"
  | "package"
  | "pizza"
  | "popcorn"
  | "salad"
  | "sandwich"
  | "shopping-basket"
  | "shopping-bag"
  | "soup"
  | "utensils"
  | "vegan"
  | "wheat"
  | "wine";

export type ProductCategoryIconOption = {
  icon: LucideIcon;
  key: ProductCategoryIconKey;
  label: string;
};

export type ProductCategoryIconMetadata = {
  categoryCode?: string | null;
  categoryName?: string | null;
  imageUrl?: string | null;
};

const iconPrefix = "icon:";

export const productCategoryIconOptions: ProductCategoryIconOption[] = [
  { icon: CakeSlice, key: "cake-slice", label: "Cake" },
  { icon: Croissant, key: "croissant", label: "Pastry" },
  { icon: Donut, key: "donut", label: "Donut" },
  { icon: Cookie, key: "cookie", label: "Cookie" },
  { icon: Candy, key: "candy", label: "Sweets" },
  { icon: CandyCane, key: "candy-cane", label: "Candy" },
  { icon: IceCreamBowl, key: "ice-cream-bowl", label: "Dessert" },
  { icon: IceCreamCone, key: "ice-cream-cone", label: "Ice cream" },
  { icon: Coffee, key: "coffee", label: "Coffee" },
  { icon: CupSoda, key: "cup-soda", label: "Beverage" },
  { icon: GlassWater, key: "glass-water", label: "Drinks" },
  { icon: Milk, key: "milk", label: "Dairy" },
  { icon: Wine, key: "wine", label: "Mocktails" },
  { icon: Sandwich, key: "sandwich", label: "Sandwich" },
  { icon: Hamburger, key: "hamburger", label: "Burger" },
  { icon: Pizza, key: "pizza", label: "Pizza" },
  { icon: Soup, key: "soup", label: "Soup" },
  { icon: Salad, key: "salad", label: "Salad" },
  { icon: Utensils, key: "utensils", label: "Meals" },
  { icon: ChefHat, key: "chef-hat", label: "Kitchen" },
  { icon: Beef, key: "beef", label: "Meat" },
  { icon: Ham, key: "ham", label: "Ham" },
  { icon: Drumstick, key: "drumstick", label: "Chicken" },
  { icon: Fish, key: "fish", label: "Seafood" },
  { icon: Wheat, key: "wheat", label: "Bakery" },
  { icon: Bean, key: "bean", label: "Beans" },
  { icon: Apple, key: "apple", label: "Fresh" },
  { icon: Banana, key: "banana", label: "Fruit" },
  { icon: Cherry, key: "cherry", label: "Cherry" },
  { icon: Grape, key: "grape", label: "Grape" },
  { icon: Carrot, key: "carrot", label: "Vegetable" },
  { icon: Vegan, key: "vegan", label: "Vegan" },
  { icon: Popcorn, key: "popcorn", label: "Snacks" },
  { icon: ShoppingBag, key: "shopping-bag", label: "Retail" },
  { icon: ShoppingBasket, key: "shopping-basket", label: "Grocery" },
  { icon: Package, key: "package", label: "Package" },
];

export const fallbackProductCategoryIcon = CakeSlice;

export function toProductCategoryIconValue(key: ProductCategoryIconKey): string {
  return `${iconPrefix}${key}`;
}

export function getProductCategoryIconKey(
  value: string | null | undefined,
): ProductCategoryIconKey | null {
  if (!value?.startsWith(iconPrefix)) {
    return null;
  }

  const key = value.slice(iconPrefix.length);
  const option = productCategoryIconOptions.find((item) => item.key === key);

  return option?.key ?? null;
}

function normalizeCategoryText(value: string | null | undefined): string {
  return value?.toLowerCase().replace(/[^a-z0-9]+/g, " ") ?? "";
}

export function getProductCategoryIconKeyFromMetadata(
  metadata: ProductCategoryIconMetadata,
): ProductCategoryIconKey | null {
  const explicitKey = getProductCategoryIconKey(metadata.imageUrl);

  if (explicitKey) {
    return explicitKey;
  }

  const text = `${normalizeCategoryText(metadata.categoryName)} ${normalizeCategoryText(
    metadata.categoryCode,
  )}`;

  if (/\b(beverage|beverages|drink|drinks|juice|mocktail|mocktails|soda|tea)\b/.test(text)) {
    return "cup-soda";
  }

  if (/\b(coffee|espresso|latte|cappuccino)\b/.test(text)) {
    return "coffee";
  }

  if (/\b(cake|cakes|birthday|celebration)\b/.test(text)) {
    return "cake-slice";
  }

  if (/\b(pastry|pastries|croissant|danish)\b/.test(text)) {
    return "croissant";
  }

  if (/\b(cookie|cookies|biscuit|biscuits)\b/.test(text)) {
    return "cookie";
  }

  if (/\b(donut|doughnut|donuts|doughnuts)\b/.test(text)) {
    return "donut";
  }

  if (/\b(dessert|desserts|ice cream|gelato)\b/.test(text)) {
    return "ice-cream-bowl";
  }

  if (/\b(sweet|sweets|candy|chocolate)\b/.test(text)) {
    return "candy";
  }

  if (/\b(snack|snacks|popcorn|chips)\b/.test(text)) {
    return "popcorn";
  }

  if (/\b(sandwich|sandwiches|wrap|wraps)\b/.test(text)) {
    return "sandwich";
  }

  if (/\b(burger|burgers)\b/.test(text)) {
    return "hamburger";
  }

  if (/\b(pizza|pizzas)\b/.test(text)) {
    return "pizza";
  }

  if (/\b(soup|soups)\b/.test(text)) {
    return "soup";
  }

  if (/\b(salad|salads)\b/.test(text)) {
    return "salad";
  }

  if (/\b(chicken|poultry)\b/.test(text)) {
    return "drumstick";
  }

  if (/\b(meat|beef|steak)\b/.test(text)) {
    return "beef";
  }

  if (/\b(fish|seafood|shrimp)\b/.test(text)) {
    return "fish";
  }

  if (/\b(milk|dairy|cheese|cream)\b/.test(text)) {
    return "milk";
  }

  if (/\b(fruit|fruits|fresh|apple|banana|grape|cherry)\b/.test(text)) {
    return "apple";
  }

  if (/\b(vegetable|vegetables|vegan|veg)\b/.test(text)) {
    return "vegan";
  }

  if (/\b(retail|grocery|groceries|item|items)\b/.test(text)) {
    return "shopping-bag";
  }

  if (/\b(package|packaging|box|boxes)\b/.test(text)) {
    return "package";
  }

  return null;
}

export function getProductCategoryIcon(value: string | null | undefined): LucideIcon {
  const key = getProductCategoryIconKey(value);
  const option = productCategoryIconOptions.find((item) => item.key === key);

  return option?.icon ?? fallbackProductCategoryIcon;
}

export function getProductCategoryIconForMetadata(
  metadata: ProductCategoryIconMetadata,
): LucideIcon {
  const key = getProductCategoryIconKeyFromMetadata(metadata);
  const option = productCategoryIconOptions.find((item) => item.key === key);

  return option?.icon ?? fallbackProductCategoryIcon;
}
