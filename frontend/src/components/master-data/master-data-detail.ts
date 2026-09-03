import type {
  OrderStatus,
  PaymentStatus,
  ProductCategory,
  SimpleCategory,
  Unit,
} from "@/types/master-data";
import type { RecordStatus } from "@/types/settings";

/**
 * One shape for every master data record.
 *
 * Six collections, five record types, and each of them is a reference record:
 * a name, a handful of attributes, a status. Mapping them all onto one
 * descriptor means one drawer and one card grid serve all six screens instead
 * of five of each.
 */
export type MasterDataDetail = {
  fields: { label: string; mono?: boolean; numeric?: boolean; value: string }[];
  id: string;
  isSystemDefault: boolean;
  status: RecordStatus;
  /** The line under the title in the drawer and on the card. */
  subtitle: string;
  title: string;
};

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

export function unitDetail(unit: Unit): MasterDataDetail {
  return {
    fields: [
      { label: "Symbol", mono: true, value: unit.symbol },
      { label: "Category", value: unit.unitCategory.name },
      { label: "Conversion factor", numeric: true, value: String(unit.conversionFactor) },
      { label: "Decimal precision", numeric: true, value: String(unit.decimalPrecision) },
      { label: "System default", value: yesNo(unit.isSystemDefault) },
    ],
    id: unit.id,
    isSystemDefault: unit.isSystemDefault,
    status: unit.status,
    subtitle: unit.symbol,
    title: unit.unitName,
  };
}

export function productCategoryDetail(category: ProductCategory): MasterDataDetail {
  return {
    fields: [
      { label: "Code", mono: true, value: category.categoryCode || "Not set" },
      {
        label: "Allowed product types",
        value:
          category.allowedProductTypes.length > 0
            ? category.allowedProductTypes.join(", ")
            : "All product types",
      },
      { label: "Description", value: category.description || "No description" },
      { label: "Sort order", numeric: true, value: String(category.sortOrder) },
    ],
    id: category.id,
    isSystemDefault: false,
    status: category.status,
    subtitle: category.categoryCode || "No code",
    title: category.categoryName,
  };
}

export function simpleCategoryDetail(category: SimpleCategory): MasterDataDetail {
  return {
    fields: [{ label: "Description", value: category.description || "No description" }],
    id: category.id,
    isSystemDefault: false,
    status: category.status,
    subtitle: category.description || "No description",
    title: category.categoryName,
  };
}

export function orderStatusDetail(status: OrderStatus): MasterDataDetail {
  return {
    fields: [
      { label: "Key", mono: true, value: status.statusKey },
      { label: "Sort order", numeric: true, value: String(status.sortOrder) },
      { label: "Final status", value: yesNo(status.isFinalStatus) },
      { label: "System default", value: yesNo(status.isSystemDefault) },
      { label: "Colour", mono: true, value: status.color || "Not set" },
    ],
    id: status.id,
    isSystemDefault: status.isSystemDefault,
    status: status.status,
    subtitle: status.statusKey,
    title: status.statusName,
  };
}

export function paymentStatusDetail(status: PaymentStatus): MasterDataDetail {
  return {
    fields: [
      { label: "Key", mono: true, value: status.statusKey },
      { label: "System default", value: yesNo(status.isSystemDefault) },
      { label: "Colour", mono: true, value: status.color || "Not set" },
    ],
    id: status.id,
    isSystemDefault: status.isSystemDefault,
    status: status.status,
    subtitle: status.statusKey,
    title: status.statusName,
  };
}

/** Client-side search across whatever the descriptor exposes. */
export function matchesMasterDataQuery(detail: MasterDataDetail, query: string): boolean {
  if (query.length === 0) {
    return true;
  }

  const haystack = [detail.title, detail.subtitle, ...detail.fields.map((field) => field.value)]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}
