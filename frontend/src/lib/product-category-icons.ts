import type { LucideIcon } from "lucide-react";
import {
  Apple,
  Archive,
  Banana,
  Bean,
  Beef,
  Boxes,
  CakeSlice,
  Candy,
  CandyCane,
  Carrot,
  ChefHat,
  Cherry,
  ClipboardList,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Donut,
  Drumstick,
  Fish,
  Gift,
  GlassWater,
  Grape,
  Ham,
  Hamburger,
  Hammer,
  IceCreamBowl,
  IceCreamCone,
  Milk,
  Package,
  PackageOpen,
  PartyPopper,
  Pizza,
  Popcorn,
  Salad,
  Sandwich,
  Settings,
  ShoppingBag,
  ShoppingBasket,
  Snowflake,
  Soup,
  Utensils,
  Vegan,
  Warehouse,
  Wheat,
  Wine,
  Wrench,
} from "lucide-react";

export type ProductCategoryIconKey =
  | "apple"
  | "archive"
  | "banana"
  | "bean"
  | "beef"
  | "boxes"
  | "bread"
  | "cake-slice"
  | "candy"
  | "candy-cane"
  | "carrot"
  | "chef-hat"
  | "cherry"
  | "chocolate"
  | "clipboard-list"
  | "coffee"
  | "cookie"
  | "croissant"
  | "cup-soda"
  | "donut"
  | "drumstick"
  | "fish"
  | "glass-water"
  | "grape"
  | "gift"
  | "ham"
  | "hammer"
  | "hamburger"
  | "ice-cream-bowl"
  | "ice-cream-cone"
  | "ingredients"
  | "juice"
  | "milk"
  | "package"
  | "package-open"
  | "party-popper"
  | "pizza"
  | "popcorn"
  | "raw-materials"
  | "salad"
  | "sandwich"
  | "settings"
  | "shopping-basket"
  | "shopping-bag"
  | "snowflake"
  | "soup"
  | "utensils"
  | "vegan"
  | "warehouse"
  | "wheat"
  | "wine"
  | "wrench";

export type ProductCategoryIconOption = {
  icon: LucideIcon;
  key: ProductCategoryIconKey;
  keywords: string[];
  label: string;
};

export type ProductCategoryIconMetadata = {
  categoryCode?: string | null;
  categoryName?: string | null;
  imageUrl?: string | null;
};

const iconPrefix = "icon:";

export const productCategoryIconOptions: ProductCategoryIconOption[] = [
  { icon: CakeSlice, key: "cake-slice", keywords: ["cake", "cakes", "birthday"], label: "Cake" },
  {
    icon: Croissant,
    key: "croissant",
    keywords: ["pastry", "pastries", "danish"],
    label: "Pastry",
  },
  { icon: Wheat, key: "bread", keywords: ["bread", "loaf", "bakery"], label: "Bread" },
  { icon: Donut, key: "donut", keywords: ["donut", "doughnut"], label: "Donut" },
  { icon: Cookie, key: "cookie", keywords: ["cookie", "cookies", "biscuit"], label: "Cookie" },
  {
    icon: Candy,
    key: "chocolate",
    keywords: ["chocolate", "cocoa", "truffle"],
    label: "Chocolate",
  },
  { icon: Candy, key: "candy", keywords: ["sweets", "sweet"], label: "Sweets" },
  { icon: CandyCane, key: "candy-cane", keywords: ["candy"], label: "Candy" },
  {
    icon: IceCreamBowl,
    key: "ice-cream-bowl",
    keywords: ["dessert", "desserts", "gelato"],
    label: "Dessert",
  },
  {
    icon: IceCreamCone,
    key: "ice-cream-cone",
    keywords: ["ice cream", "frozen dessert"],
    label: "Ice cream",
  },
  { icon: Coffee, key: "coffee", keywords: ["coffee", "espresso", "latte"], label: "Hot drinks" },
  { icon: CupSoda, key: "juice", keywords: ["juice", "fresh juice"], label: "Juices" },
  {
    icon: CupSoda,
    key: "cup-soda",
    keywords: ["beverage", "cold drinks", "soda"],
    label: "Cold drinks",
  },
  { icon: GlassWater, key: "glass-water", keywords: ["drinks", "water"], label: "Drinks" },
  { icon: Milk, key: "milk", keywords: ["dairy", "milk", "cheese", "cream"], label: "Dairy" },
  { icon: Wine, key: "wine", keywords: ["mocktails", "special drinks"], label: "Mocktails" },
  { icon: Sandwich, key: "sandwich", keywords: ["sandwich", "wrap"], label: "Sandwich" },
  { icon: Hamburger, key: "hamburger", keywords: ["burger"], label: "Burger" },
  { icon: Pizza, key: "pizza", keywords: ["pizza"], label: "Pizza" },
  { icon: Soup, key: "soup", keywords: ["soup"], label: "Soup" },
  { icon: Salad, key: "salad", keywords: ["salad"], label: "Salad" },
  { icon: Utensils, key: "utensils", keywords: ["meals", "food"], label: "Meals" },
  { icon: ChefHat, key: "chef-hat", keywords: ["kitchen", "chef"], label: "Kitchen" },
  { icon: Beef, key: "beef", keywords: ["meat", "beef"], label: "Meat" },
  { icon: Ham, key: "ham", keywords: ["ham"], label: "Ham" },
  { icon: Drumstick, key: "drumstick", keywords: ["chicken", "poultry"], label: "Chicken" },
  { icon: Fish, key: "fish", keywords: ["seafood", "fish"], label: "Seafood" },
  { icon: Wheat, key: "wheat", keywords: ["bakery", "wheat", "flour"], label: "Bakery" },
  {
    icon: Bean,
    key: "ingredients",
    keywords: ["ingredient", "ingredients", "bom", "component"],
    label: "Ingredients",
  },
  {
    icon: Archive,
    key: "raw-materials",
    keywords: ["raw material", "raw materials", "material"],
    label: "Raw materials",
  },
  { icon: Bean, key: "bean", keywords: ["beans", "dry ingredient"], label: "Beans" },
  { icon: Apple, key: "apple", keywords: ["fresh", "fruit"], label: "Fresh" },
  { icon: Banana, key: "banana", keywords: ["fruit", "banana"], label: "Fruit" },
  { icon: Cherry, key: "cherry", keywords: ["cherry"], label: "Cherry" },
  { icon: Grape, key: "grape", keywords: ["grape"], label: "Grape" },
  { icon: Carrot, key: "carrot", keywords: ["vegetable"], label: "Vegetable" },
  { icon: Vegan, key: "vegan", keywords: ["vegan", "veg"], label: "Vegan" },
  { icon: Popcorn, key: "popcorn", keywords: ["snacks", "chips"], label: "Snacks" },
  { icon: ShoppingBag, key: "shopping-bag", keywords: ["retail"], label: "Retail" },
  { icon: ShoppingBasket, key: "shopping-basket", keywords: ["grocery"], label: "Grocery" },
  { icon: Package, key: "package", keywords: ["package", "packaging"], label: "Package" },
  {
    icon: Boxes,
    key: "boxes",
    keywords: ["packaging", "boxes", "cartons", "containers"],
    label: "Packaging",
  },
  {
    icon: PackageOpen,
    key: "package-open",
    keywords: ["consumable", "consumables", "supplies"],
    label: "Consumables",
  },
  { icon: Warehouse, key: "warehouse", keywords: ["warehouse", "store"], label: "Warehouse" },
  { icon: Archive, key: "archive", keywords: ["dry goods", "dry stock"], label: "Dry goods" },
  {
    icon: Snowflake,
    key: "snowflake",
    keywords: ["frozen", "freezer", "cold storage"],
    label: "Frozen",
  },
  { icon: Wrench, key: "wrench", keywords: ["equipment", "machine", "tool"], label: "Equipment" },
  { icon: Hammer, key: "hammer", keywords: ["maintenance", "tools"], label: "Tools" },
  { icon: Settings, key: "settings", keywords: ["service", "services"], label: "Services" },
  {
    icon: Gift,
    key: "gift",
    keywords: ["celebration", "birthday", "gift"],
    label: "Celebration",
  },
  {
    icon: PartyPopper,
    key: "party-popper",
    keywords: ["party", "event", "occasion"],
    label: "Party",
  },
  {
    icon: ClipboardList,
    key: "clipboard-list",
    keywords: ["custom order", "custom bakery order", "special order"],
    label: "Custom orders",
  },
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

  if (/\b(custom|customs|custom order|custom orders|special order|special orders)\b/.test(text)) {
    return "clipboard-list";
  }

  if (/\b(frozen|freezer|cold storage)\b/.test(text)) {
    return "snowflake";
  }

  if (/\b(equipment|machine|machines|tool|tools)\b/.test(text)) {
    return "wrench";
  }

  if (/\b(service|services)\b/.test(text)) {
    return "settings";
  }

  if (/\b(dry goods|dry stock)\b/.test(text)) {
    return "archive";
  }

  if (/\b(raw material|raw materials|raw|material|materials)\b/.test(text)) {
    return "raw-materials";
  }

  if (/\b(ingredient|ingredients|component|components)\b/.test(text)) {
    return "ingredients";
  }

  if (/\b(consumable|consumables|supplies)\b/.test(text)) {
    return "package-open";
  }

  if (/\b(package|packaging|box|boxes|carton|cartons)\b/.test(text)) {
    return "boxes";
  }

  if (/\b(warehouse|store room|store)\b/.test(text)) {
    return "warehouse";
  }

  if (/\b(juice|juices|fresh juice|fresh juices)\b/.test(text)) {
    return "juice";
  }

  if (/\b(beverage|beverages|drink|drinks|mocktail|mocktails|soda|tea)\b/.test(text)) {
    return "cup-soda";
  }

  if (/\b(coffee|espresso|latte|cappuccino)\b/.test(text)) {
    return "coffee";
  }

  if (/\b(cake|cakes|birthday|celebration)\b/.test(text)) {
    return "cake-slice";
  }

  if (/\b(bread|breads|loaf|loaves)\b/.test(text)) {
    return "bread";
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

  if (/\b(chocolate|cocoa|truffle|truffles)\b/.test(text)) {
    return "chocolate";
  }

  if (/\b(sweet|sweets|candy)\b/.test(text)) {
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
