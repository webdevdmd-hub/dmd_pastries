/**
 * Category icons.
 *
 * Emoji rather than a line-icon set or 3D image assets. They render in full
 * colour with the platform's own dimensional shading -- Segoe UI Emoji on a
 * Windows counter terminal, Apple Color Emoji on an iPad -- so the picker is
 * vibrant without shipping a single binary. A 100+ set of rendered 3D PNGs
 * would be several megabytes, would need its licence checked, and would load
 * on every screen that draws a category chip.
 *
 * The first 52 keys are unchanged. They are stored as "icon:<key>", so renaming
 * one would orphan every category already using it.
 */

export type ProductCategoryIconKey =
  | "cake-slice"
  | "croissant"
  | "bread"
  | "donut"
  | "cookie"
  | "chocolate"
  | "candy"
  | "candy-cane"
  | "ice-cream-bowl"
  | "ice-cream-cone"
  | "coffee"
  | "juice"
  | "cup-soda"
  | "glass-water"
  | "milk"
  | "wine"
  | "sandwich"
  | "hamburger"
  | "pizza"
  | "soup"
  | "salad"
  | "utensils"
  | "chef-hat"
  | "beef"
  | "ham"
  | "drumstick"
  | "fish"
  | "wheat"
  | "ingredients"
  | "raw-materials"
  | "bean"
  | "apple"
  | "banana"
  | "cherry"
  | "grape"
  | "carrot"
  | "vegan"
  | "popcorn"
  | "shopping-bag"
  | "shopping-basket"
  | "package"
  | "boxes"
  | "package-open"
  | "warehouse"
  | "archive"
  | "snowflake"
  | "wrench"
  | "hammer"
  | "settings"
  | "gift"
  | "party-popper"
  | "clipboard-list"
  | "cupcake"
  | "birthday-cake"
  | "pie"
  | "custard"
  | "pancake"
  | "waffle"
  | "pretzel"
  | "bagel"
  | "baguette"
  | "flatbread"
  | "mooncake"
  | "rice-cracker"
  | "honey"
  | "preserves"
  | "butter"
  | "cheese"
  | "egg"
  | "salt"
  | "herbs"
  | "spices"
  | "nuts"
  | "chestnut"
  | "garlic"
  | "onion"
  | "oil"
  | "rice"
  | "lemon"
  | "orange"
  | "strawberry"
  | "blueberry"
  | "peach"
  | "pear"
  | "pineapple"
  | "mango"
  | "watermelon"
  | "coconut"
  | "kiwi"
  | "dates"
  | "tomato"
  | "potato"
  | "corn"
  | "mushroom"
  | "greens"
  | "cucumber"
  | "avocado"
  | "tea"
  | "bubble-tea"
  | "iced-drinks"
  | "smoothie"
  | "sparkling"
  | "water"
  | "noodles"
  | "pasta"
  | "sushi"
  | "taco"
  | "wrap"
  | "fries"
  | "hot-dog"
  | "kebab"
  | "curry"
  | "hot-meals"
  | "meal-box"
  | "breakfast"
  | "bacon"
  | "prawns"
  | "crab"
  | "turkey"
  | "delivery"
  | "labels"
  | "receipts"
  | "scale"
  | "temperature"
  | "baking"
  | "prep-time"
  | "cleaning"
  | "uniform"
  | "recipes"
  | "recycling"
  | "featured"
  | "best-sellers"
  | "new-arrivals"
  | "organic"
  | "plant-based"
  | "kids"
  | "health"
  | "seasonal"
  | "summer"
  | "winter"
  | "ramadan"
  | "eid"
  | "christmas"
  | "valentine"
  | "wedding";

export type ProductCategoryIconOption = {
  emoji: string;
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
  {
    emoji: "🍰",
    key: "cake-slice",
    keywords: ["cake", "cakes", "birthday"],
    label: "Cake",
  },
  {
    emoji: "🥐",
    key: "croissant",
    keywords: ["pastry", "pastries", "danish"],
    label: "Pastry",
  },
  {
    emoji: "🍞",
    key: "bread",
    keywords: ["bread", "loaf", "bakery"],
    label: "Bread",
  },
  {
    emoji: "🍩",
    key: "donut",
    keywords: ["donut", "doughnut"],
    label: "Donut",
  },
  {
    emoji: "🍪",
    key: "cookie",
    keywords: ["cookie", "cookies", "biscuit"],
    label: "Cookie",
  },
  {
    emoji: "🍫",
    key: "chocolate",
    keywords: ["chocolate", "cocoa", "truffle"],
    label: "Chocolate",
  },
  {
    emoji: "🍬",
    key: "candy",
    keywords: ["sweets", "sweet"],
    label: "Sweets",
  },
  {
    emoji: "🍭",
    key: "candy-cane",
    keywords: ["candy"],
    label: "Candy",
  },
  {
    emoji: "🍨",
    key: "ice-cream-bowl",
    keywords: ["dessert", "desserts", "gelato"],
    label: "Dessert",
  },
  {
    emoji: "🍦",
    key: "ice-cream-cone",
    keywords: ["ice cream", "frozen dessert"],
    label: "Ice cream",
  },
  {
    emoji: "☕",
    key: "coffee",
    keywords: ["coffee", "espresso", "latte"],
    label: "Hot drinks",
  },
  {
    emoji: "🧃",
    key: "juice",
    keywords: ["juice", "fresh juice"],
    label: "Juices",
  },
  {
    emoji: "🥤",
    key: "cup-soda",
    keywords: ["beverage", "cold drinks", "soda"],
    label: "Cold drinks",
  },
  {
    emoji: "💧",
    key: "glass-water",
    keywords: ["drinks", "water"],
    label: "Drinks",
  },
  {
    emoji: "🥛",
    key: "milk",
    keywords: ["dairy", "milk", "cheese", "cream"],
    label: "Dairy",
  },
  {
    emoji: "🍹",
    key: "wine",
    keywords: ["mocktails", "special drinks"],
    label: "Mocktails",
  },
  {
    emoji: "🥪",
    key: "sandwich",
    keywords: ["sandwich", "wrap"],
    label: "Sandwich",
  },
  {
    emoji: "🍔",
    key: "hamburger",
    keywords: ["burger"],
    label: "Burger",
  },
  {
    emoji: "🍕",
    key: "pizza",
    keywords: ["pizza"],
    label: "Pizza",
  },
  {
    emoji: "🍲",
    key: "soup",
    keywords: ["soup"],
    label: "Soup",
  },
  {
    emoji: "🥗",
    key: "salad",
    keywords: ["salad"],
    label: "Salad",
  },
  {
    emoji: "🍽️",
    key: "utensils",
    keywords: ["meals", "food"],
    label: "Meals",
  },
  {
    emoji: "👨‍🍳",
    key: "chef-hat",
    keywords: ["kitchen", "chef"],
    label: "Kitchen",
  },
  {
    emoji: "🥩",
    key: "beef",
    keywords: ["meat", "beef"],
    label: "Meat",
  },
  {
    emoji: "🍖",
    key: "ham",
    keywords: ["ham"],
    label: "Ham",
  },
  {
    emoji: "🍗",
    key: "drumstick",
    keywords: ["chicken", "poultry"],
    label: "Chicken",
  },
  {
    emoji: "🐟",
    key: "fish",
    keywords: ["seafood", "fish"],
    label: "Seafood",
  },
  {
    emoji: "🌾",
    key: "wheat",
    keywords: ["bakery", "wheat", "flour"],
    label: "Bakery",
  },
  {
    emoji: "🥣",
    key: "ingredients",
    keywords: ["ingredient", "ingredients", "bom", "component"],
    label: "Ingredients",
  },
  {
    emoji: "🧱",
    key: "raw-materials",
    keywords: ["raw material", "raw materials", "material"],
    label: "Raw materials",
  },
  {
    emoji: "🫘",
    key: "bean",
    keywords: ["beans", "dry ingredient"],
    label: "Beans",
  },
  {
    emoji: "🍎",
    key: "apple",
    keywords: ["fresh", "fruit"],
    label: "Fresh",
  },
  {
    emoji: "🍌",
    key: "banana",
    keywords: ["fruit", "banana"],
    label: "Fruit",
  },
  {
    emoji: "🍒",
    key: "cherry",
    keywords: ["cherry"],
    label: "Cherry",
  },
  {
    emoji: "🍇",
    key: "grape",
    keywords: ["grape"],
    label: "Grape",
  },
  {
    emoji: "🥕",
    key: "carrot",
    keywords: ["vegetable"],
    label: "Vegetable",
  },
  {
    emoji: "🥬",
    key: "vegan",
    keywords: ["vegan", "veg"],
    label: "Vegan",
  },
  {
    emoji: "🍿",
    key: "popcorn",
    keywords: ["snacks", "chips"],
    label: "Snacks",
  },
  {
    emoji: "🛍️",
    key: "shopping-bag",
    keywords: ["retail"],
    label: "Retail",
  },
  {
    emoji: "🧺",
    key: "shopping-basket",
    keywords: ["grocery"],
    label: "Grocery",
  },
  {
    emoji: "📦",
    key: "package",
    keywords: ["package", "packaging"],
    label: "Package",
  },
  {
    emoji: "🗃️",
    key: "boxes",
    keywords: ["packaging", "boxes", "cartons", "containers"],
    label: "Packaging",
  },
  {
    emoji: "🧻",
    key: "package-open",
    keywords: ["consumable", "consumables", "supplies"],
    label: "Consumables",
  },
  {
    emoji: "🏬",
    key: "warehouse",
    keywords: ["warehouse", "store"],
    label: "Warehouse",
  },
  {
    emoji: "🥫",
    key: "archive",
    keywords: ["dry goods", "dry stock"],
    label: "Dry goods",
  },
  {
    emoji: "❄️",
    key: "snowflake",
    keywords: ["frozen", "freezer", "cold storage"],
    label: "Frozen",
  },
  {
    emoji: "🔧",
    key: "wrench",
    keywords: ["equipment", "machine", "tool"],
    label: "Equipment",
  },
  {
    emoji: "🔨",
    key: "hammer",
    keywords: ["maintenance", "tools"],
    label: "Tools",
  },
  {
    emoji: "⚙️",
    key: "settings",
    keywords: ["service", "services"],
    label: "Services",
  },
  {
    emoji: "🎁",
    key: "gift",
    keywords: ["celebration", "birthday", "gift"],
    label: "Celebration",
  },
  {
    emoji: "🎉",
    key: "party-popper",
    keywords: ["party", "event", "occasion"],
    label: "Party",
  },
  {
    emoji: "📋",
    key: "clipboard-list",
    keywords: ["custom order", "custom bakery order", "special order"],
    label: "Custom orders",
  },
  {
    emoji: "🧁",
    key: "cupcake",
    keywords: ["cupcake", "muffin", "fairy cake"],
    label: "Cupcake",
  },
  {
    emoji: "🎂",
    key: "birthday-cake",
    keywords: ["birthday", "celebration cake", "candles"],
    label: "Birthday cake",
  },
  {
    emoji: "🥧",
    key: "pie",
    keywords: ["pie", "tart", "quiche"],
    label: "Pie",
  },
  {
    emoji: "🍮",
    key: "custard",
    keywords: ["custard", "flan", "pudding", "creme caramel"],
    label: "Custard",
  },
  {
    emoji: "🥞",
    key: "pancake",
    keywords: ["pancake", "pancakes", "crepe"],
    label: "Pancakes",
  },
  {
    emoji: "🧇",
    key: "waffle",
    keywords: ["waffle", "waffles"],
    label: "Waffles",
  },
  {
    emoji: "🥨",
    key: "pretzel",
    keywords: ["pretzel", "savoury bake"],
    label: "Pretzel",
  },
  {
    emoji: "🥯",
    key: "bagel",
    keywords: ["bagel", "bagels"],
    label: "Bagel",
  },
  {
    emoji: "🥖",
    key: "baguette",
    keywords: ["baguette", "french bread", "stick"],
    label: "Baguette",
  },
  {
    emoji: "🫓",
    key: "flatbread",
    keywords: ["flatbread", "pita", "khubz", "roti"],
    label: "Flatbread",
  },
  {
    emoji: "🥮",
    key: "mooncake",
    keywords: ["festive", "mooncake", "seasonal bake"],
    label: "Festive bake",
  },
  {
    emoji: "🍘",
    key: "rice-cracker",
    keywords: ["cracker", "crackers", "crispbread"],
    label: "Crackers",
  },
  {
    emoji: "🍯",
    key: "honey",
    keywords: ["honey", "syrup", "sweetener"],
    label: "Honey",
  },
  {
    emoji: "🫙",
    key: "preserves",
    keywords: ["jam", "preserve", "conserve", "spread"],
    label: "Preserves",
  },
  {
    emoji: "🧈",
    key: "butter",
    keywords: ["butter", "margarine", "fat"],
    label: "Butter",
  },
  {
    emoji: "🧀",
    key: "cheese",
    keywords: ["cheese", "cheddar", "mozzarella"],
    label: "Cheese",
  },
  {
    emoji: "🥚",
    key: "egg",
    keywords: ["egg", "eggs"],
    label: "Eggs",
  },
  {
    emoji: "🧂",
    key: "salt",
    keywords: ["salt", "seasoning", "sugar", "pantry"],
    label: "Seasoning",
  },
  {
    emoji: "🌿",
    key: "herbs",
    keywords: ["herb", "herbs", "mint", "basil"],
    label: "Herbs",
  },
  {
    emoji: "🌶️",
    key: "spices",
    keywords: ["spice", "spices", "chilli", "pepper"],
    label: "Spices",
  },
  {
    emoji: "🥜",
    key: "nuts",
    keywords: ["nut", "nuts", "peanut", "almond"],
    label: "Nuts",
  },
  {
    emoji: "🌰",
    key: "chestnut",
    keywords: ["seed", "seeds", "chestnut"],
    label: "Seeds",
  },
  {
    emoji: "🧄",
    key: "garlic",
    keywords: ["garlic"],
    label: "Garlic",
  },
  {
    emoji: "🧅",
    key: "onion",
    keywords: ["onion", "shallot"],
    label: "Onion",
  },
  {
    emoji: "🫒",
    key: "oil",
    keywords: ["oil", "olive", "cooking oil"],
    label: "Oils",
  },
  {
    emoji: "🍚",
    key: "rice",
    keywords: ["rice", "grain"],
    label: "Rice",
  },
  {
    emoji: "🍋",
    key: "lemon",
    keywords: ["lemon", "lime", "citrus"],
    label: "Citrus",
  },
  {
    emoji: "🍊",
    key: "orange",
    keywords: ["orange", "tangerine"],
    label: "Orange",
  },
  {
    emoji: "🍓",
    key: "strawberry",
    keywords: ["strawberry", "berry", "berries"],
    label: "Berries",
  },
  {
    emoji: "🫐",
    key: "blueberry",
    keywords: ["blueberry", "blueberries"],
    label: "Blueberry",
  },
  {
    emoji: "🍑",
    key: "peach",
    keywords: ["peach", "apricot"],
    label: "Peach",
  },
  {
    emoji: "🍐",
    key: "pear",
    keywords: ["pear"],
    label: "Pear",
  },
  {
    emoji: "🍍",
    key: "pineapple",
    keywords: ["pineapple"],
    label: "Pineapple",
  },
  {
    emoji: "🥭",
    key: "mango",
    keywords: ["mango"],
    label: "Mango",
  },
  {
    emoji: "🍉",
    key: "watermelon",
    keywords: ["watermelon", "melon"],
    label: "Melon",
  },
  {
    emoji: "🥥",
    key: "coconut",
    keywords: ["coconut"],
    label: "Coconut",
  },
  {
    emoji: "🥝",
    key: "kiwi",
    keywords: ["kiwi"],
    label: "Kiwi",
  },
  {
    emoji: "🌴",
    key: "dates",
    keywords: ["date", "dates", "palm"],
    label: "Dates",
  },
  {
    emoji: "🍅",
    key: "tomato",
    keywords: ["tomato"],
    label: "Tomato",
  },
  {
    emoji: "🥔",
    key: "potato",
    keywords: ["potato", "potatoes"],
    label: "Potato",
  },
  {
    emoji: "🌽",
    key: "corn",
    keywords: ["corn", "maize", "sweetcorn"],
    label: "Corn",
  },
  {
    emoji: "🍄",
    key: "mushroom",
    keywords: ["mushroom", "mushrooms"],
    label: "Mushroom",
  },
  {
    emoji: "🥦",
    key: "greens",
    keywords: ["broccoli", "greens", "leafy"],
    label: "Greens",
  },
  {
    emoji: "🥒",
    key: "cucumber",
    keywords: ["cucumber", "pickle"],
    label: "Cucumber",
  },
  {
    emoji: "🥑",
    key: "avocado",
    keywords: ["avocado"],
    label: "Avocado",
  },
  {
    emoji: "🍵",
    key: "tea",
    keywords: ["tea", "green tea", "herbal"],
    label: "Tea",
  },
  {
    emoji: "🧋",
    key: "bubble-tea",
    keywords: ["bubble tea", "boba", "milk tea"],
    label: "Bubble tea",
  },
  {
    emoji: "🧊",
    key: "iced-drinks",
    keywords: ["ice", "iced", "frappe", "cold brew"],
    label: "Iced drinks",
  },
  {
    emoji: "🥄",
    key: "smoothie",
    keywords: ["smoothie", "shake", "milkshake"],
    label: "Smoothies",
  },
  {
    emoji: "🫧",
    key: "sparkling",
    keywords: ["sparkling", "soda water", "fizzy"],
    label: "Sparkling",
  },
  {
    emoji: "🚰",
    key: "water",
    keywords: ["water", "still water", "mineral"],
    label: "Water",
  },
  {
    emoji: "🍜",
    key: "noodles",
    keywords: ["noodle", "noodles", "ramen"],
    label: "Noodles",
  },
  {
    emoji: "🍝",
    key: "pasta",
    keywords: ["pasta", "spaghetti"],
    label: "Pasta",
  },
  {
    emoji: "🍣",
    key: "sushi",
    keywords: ["sushi", "maki"],
    label: "Sushi",
  },
  {
    emoji: "🌮",
    key: "taco",
    keywords: ["taco", "tacos"],
    label: "Taco",
  },
  {
    emoji: "🌯",
    key: "wrap",
    keywords: ["wrap", "burrito", "shawarma"],
    label: "Wraps",
  },
  {
    emoji: "🍟",
    key: "fries",
    keywords: ["fries", "chips", "sides"],
    label: "Fries",
  },
  {
    emoji: "🌭",
    key: "hot-dog",
    keywords: ["hot dog", "sausage roll"],
    label: "Hot dog",
  },
  {
    emoji: "🥙",
    key: "kebab",
    keywords: ["kebab", "shawarma", "stuffed pita"],
    label: "Kebab",
  },
  {
    emoji: "🍛",
    key: "curry",
    keywords: ["curry", "masala"],
    label: "Curry",
  },
  {
    emoji: "🥘",
    key: "hot-meals",
    keywords: ["hot meal", "stew", "casserole"],
    label: "Hot meals",
  },
  {
    emoji: "🍱",
    key: "meal-box",
    keywords: ["meal box", "bento", "lunch box", "catering"],
    label: "Meal box",
  },
  {
    emoji: "🍳",
    key: "breakfast",
    keywords: ["breakfast", "egg", "brunch"],
    label: "Breakfast",
  },
  {
    emoji: "🥓",
    key: "bacon",
    keywords: ["bacon", "rashers"],
    label: "Bacon",
  },
  {
    emoji: "🦐",
    key: "prawns",
    keywords: ["prawn", "prawns", "shrimp"],
    label: "Prawns",
  },
  {
    emoji: "🦀",
    key: "crab",
    keywords: ["crab", "shellfish", "lobster"],
    label: "Shellfish",
  },
  {
    emoji: "🦃",
    key: "turkey",
    keywords: ["turkey"],
    label: "Turkey",
  },
  {
    emoji: "🚚",
    key: "delivery",
    keywords: ["delivery", "dispatch", "courier"],
    label: "Delivery",
  },
  {
    emoji: "🏷️",
    key: "labels",
    keywords: ["label", "labels", "sticker", "tag"],
    label: "Labels",
  },
  {
    emoji: "🧾",
    key: "receipts",
    keywords: ["receipt", "document", "paperwork"],
    label: "Documents",
  },
  {
    emoji: "⚖️",
    key: "scale",
    keywords: ["scale", "weighing", "weight"],
    label: "Weighing",
  },
  {
    emoji: "🌡️",
    key: "temperature",
    keywords: ["temperature", "thermometer", "chilled"],
    label: "Temperature",
  },
  {
    emoji: "🔥",
    key: "baking",
    keywords: ["baking", "oven", "bake"],
    label: "Baking",
  },
  {
    emoji: "⏱️",
    key: "prep-time",
    keywords: ["prep", "timer", "preparation"],
    label: "Prep time",
  },
  {
    emoji: "🧼",
    key: "cleaning",
    keywords: ["cleaning", "soap", "hygiene"],
    label: "Cleaning",
  },
  {
    emoji: "🦺",
    key: "uniform",
    keywords: ["uniform", "apron", "workwear"],
    label: "Uniform",
  },
  {
    emoji: "📚",
    key: "recipes",
    keywords: ["recipe", "recipes", "book"],
    label: "Recipes",
  },
  {
    emoji: "♻️",
    key: "recycling",
    keywords: ["recycling", "waste", "disposal"],
    label: "Recycling",
  },
  {
    emoji: "⭐",
    key: "featured",
    keywords: ["featured", "highlight", "star"],
    label: "Featured",
  },
  {
    emoji: "💯",
    key: "best-sellers",
    keywords: ["best seller", "popular", "top"],
    label: "Best sellers",
  },
  {
    emoji: "🆕",
    key: "new-arrivals",
    keywords: ["new", "new arrival", "launch"],
    label: "New arrivals",
  },
  {
    emoji: "🌱",
    key: "organic",
    keywords: ["organic", "natural"],
    label: "Organic",
  },
  {
    emoji: "🍃",
    key: "plant-based",
    keywords: ["plant based", "vegetarian"],
    label: "Plant based",
  },
  {
    emoji: "🧸",
    key: "kids",
    keywords: ["kids", "children", "child"],
    label: "Kids",
  },
  {
    emoji: "💊",
    key: "health",
    keywords: ["health", "supplement", "wellness"],
    label: "Health",
  },
  {
    emoji: "🍁",
    key: "seasonal",
    keywords: ["seasonal", "autumn", "limited"],
    label: "Seasonal",
  },
  {
    emoji: "☀️",
    key: "summer",
    keywords: ["summer", "warm weather"],
    label: "Summer",
  },
  {
    emoji: "⛄",
    key: "winter",
    keywords: ["winter", "cold weather"],
    label: "Winter",
  },
  {
    emoji: "🌙",
    key: "ramadan",
    keywords: ["ramadan", "iftar", "suhoor"],
    label: "Ramadan",
  },
  {
    emoji: "🕌",
    key: "eid",
    keywords: ["eid", "festival"],
    label: "Eid",
  },
  {
    emoji: "🎄",
    key: "christmas",
    keywords: ["christmas", "xmas", "festive"],
    label: "Christmas",
  },
  {
    emoji: "💝",
    key: "valentine",
    keywords: ["valentine", "romance", "love"],
    label: "Valentine",
  },
  {
    emoji: "💍",
    key: "wedding",
    keywords: ["wedding", "engagement", "bridal"],
    label: "Wedding",
  },
];

export const fallbackProductCategoryEmoji = "🍰";

const optionsByKey = new Map<string, ProductCategoryIconOption>(
  productCategoryIconOptions.map((option) => [option.key, option]),
);

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

export function getProductCategoryEmoji(value: string | null | undefined): string {
  const key = getProductCategoryIconKey(value);

  return (key ? optionsByKey.get(key)?.emoji : undefined) ?? fallbackProductCategoryEmoji;
}

export function getProductCategoryEmojiForMetadata(metadata: ProductCategoryIconMetadata): string {
  const key = getProductCategoryIconKeyFromMetadata(metadata);

  return (key ? optionsByKey.get(key)?.emoji : undefined) ?? fallbackProductCategoryEmoji;
}
