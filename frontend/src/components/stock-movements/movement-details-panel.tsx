"use client";

import Link from "next/link";
import type { JSX, ReactNode } from "react";

import { AccountingJournalLink } from "@/components/shared/accounting-reference-links";
import {
  MOVEMENT_DETAIL_BASE_PATH,
  type MovementDetailTabKey,
} from "@/components/stock-movements/movement-detail-tabs";
import {
  MOVEMENT_DETAIL_TABPANEL_ID,
  MovementDetailViewTabs,
} from "@/components/stock-movements/movement-detail-view-tabs";
import { Button } from "@/components/ui/button";
import {
  sourceModuleLabel,
  sourceReferenceLabel,
  stockMovementDescription,
} from "@/lib/inventory/stock-movement-display";
import type { StockMovement } from "@/types/stock-movements";

export function formatMovementDateTime(value: string): string {
  return value ? new Date(value).toLocaleString("en-AE") : "Not recorded";
}

export function formatMovementQuantity(value: number, unit: string): string {
  return `${new Intl.NumberFormat("en-AE", { maximumFractionDigits: 3 }).format(value)} ${unit}`;
}

export function formatMovementMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    style: "currency",
  }).format(value);
}

export function movementItemTypeLabel(value: StockMovement["itemType"]): string {
  if (value === "product_variant") return "Variant";
  if (value === "product") return "Product";
  if (value === "ingredient") return "Ingredient";
  return "Packaging";
}

/**
 * Backend enums reach these two fields as free-form strings -- `weighted_average`,
 * `bakery_order_cancelled` -- and were printed raw. There is no label map to
 * key off, so sentence-case the token rather than show a database value.
 */
export function humaniseMovementToken(value: string | null, fallback: string): string {
  if (value === null || value.trim().length === 0) {
    return fallback;
  }
  const words = value.trim().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function movementLocationName(value: string | null): string {
  return value && value.trim().length > 0 ? value : "Unknown location";
}

function InfoField({
  label,
  mono = false,
  numeric = false,
  value,
}: {
  label: string;
  /** Ids and reference numbers read as codes, so they get the mono face. */
  mono?: boolean;
  numeric?: boolean;
  value: ReactNode;
}): JSX.Element {
  return (
    <div className="min-w-0">
      <p className="text-meta text-foreground-muted">{label}</p>
      <p
        className={[
          "mt-0.5 break-words text-cell font-medium",
          mono ? "font-mono" : "",
          numeric ? "tabular-nums" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {value}
      </p>
    </div>
  );
}

function SectionCard({ children }: { children: ReactNode }): JSX.Element {
  return <div className="rounded-lg border border-border bg-card p-4">{children}</div>;
}

type MovementDetailsPanelProps = {
  activeTab: MovementDetailTabKey;
  movement: StockMovement;
  onTabChange: (tab: MovementDetailTabKey) => void;
};

/**
 * The body of a stock movement, shared by the drawer over the ledger and the
 * full page at /inventory/movements/[id]. One component so the two cannot
 * drift: a drawer that showed less than the page it links to would make the
 * page the real one and the drawer a teaser.
 */
export function MovementDetailsPanel({
  activeTab,
  movement,
  onTabChange,
}: MovementDetailsPanelProps): JSX.Element {
  const isTransfer = movement.movementType === "transfer";
  const hasCost = movement.totalCost > 0 || movement.unitCostSnapshot > 0;

  return (
    <div className="grid min-w-0 gap-6">
      <MovementDetailViewTabs
        active={activeTab}
        movementId={movement.id}
        onTabChange={onTabChange}
      />

      <div className="min-w-0" id={MOVEMENT_DETAIL_TABPANEL_ID} role="tabpanel" tabIndex={-1}>
        {activeTab === "movement" ? (
          <div className="grid gap-4">
            <SectionCard>
              <p className="text-meta text-foreground-muted">What happened</p>
              <p className="mt-1 text-cell font-medium">{stockMovementDescription(movement)}</p>
            </SectionCard>

            <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
              <InfoField label="Item" value={movement.itemName} />
              <InfoField label="Item type" value={movementItemTypeLabel(movement.itemType)} />
              <InfoField label="Branch" value={movement.branchName} />
              <InfoField
                label="Quantity"
                numeric
                value={formatMovementQuantity(movement.quantity, movement.unitSymbol)}
              />
              {/* Before and after are one field, not two: the ledger's subject
                  is the change, and reading it as a pair is the whole job. */}
              <InfoField
                label="Stock level"
                numeric
                value={
                  <>
                    {formatMovementQuantity(movement.beforeQuantity, movement.unitSymbol)}
                    <span className="mx-1.5 text-foreground-muted">&rarr;</span>
                    {formatMovementQuantity(movement.afterQuantity, movement.unitSymbol)}
                  </>
                }
              />
              {isTransfer ? (
                <>
                  <InfoField
                    label="From location"
                    value={movementLocationName(movement.fromStockLocationName)}
                  />
                  <InfoField
                    label="To location"
                    value={movementLocationName(movement.toStockLocationName)}
                  />
                </>
              ) : null}
            </div>

            <SectionCard>
              <p className="text-meta text-foreground-muted">Reason</p>
              <p className="mt-1 text-cell">
                {movement.reason ?? stockMovementDescription(movement)}
              </p>
              {movement.notes ? (
                <>
                  <p className="mt-4 text-meta text-foreground-muted">Notes</p>
                  <p className="mt-1 text-cell">{movement.notes}</p>
                </>
              ) : null}
            </SectionCard>
          </div>
        ) : null}

        {activeTab === "costing" ? (
          <div className="grid gap-4">
            <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
              <InfoField
                label="Unit cost"
                numeric
                value={
                  movement.unitCostSnapshot > 0
                    ? formatMovementMoney(movement.unitCostSnapshot)
                    : "Not costed"
                }
              />
              <InfoField
                label="Total cost"
                numeric
                value={
                  movement.totalCost > 0 ? formatMovementMoney(movement.totalCost) : "Not costed"
                }
              />
              <InfoField
                label="Valuation method"
                value={humaniseMovementToken(movement.valuationMethod, "Not set")}
              />
            </div>

            {/* An uncosted movement is not a bug to hide. Saying so beats two
                "Not costed" fields and no explanation of why. */}
            {!hasCost ? (
              <SectionCard>
                <p className="text-cell text-foreground-muted">
                  This movement carries no cost snapshot, so it does not affect inventory valuation.
                </p>
              </SectionCard>
            ) : null}

            <SectionCard>
              <p className="text-meta text-foreground-muted">Accounting journal</p>
              {movement.accountingJournalEntryId ? (
                <>
                  <p className="mt-1 break-words font-mono text-cell font-medium">
                    {movement.accountingJournalEntryId}
                  </p>
                  <div className="mt-3">
                    <AccountingJournalLink id={movement.accountingJournalEntryId} />
                  </div>
                </>
              ) : (
                <p className="mt-1 text-cell text-foreground-muted">
                  No accounting journal was posted from this movement. Operational stock and
                  accounting inventory move on separate triggers.
                </p>
              )}
            </SectionCard>
          </div>
        ) : null}

        {activeTab === "trace" ? (
          <div className="grid gap-4">
            <SectionCard>
              <p className="text-meta text-foreground-muted">Written by</p>
              <p className="mt-1 text-cell font-medium">{sourceModuleLabel(movement)}</p>
              <p className="mt-0.5 text-cell text-foreground-muted">
                {sourceReferenceLabel(movement)}
              </p>
            </SectionCard>

            <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
              <InfoField label="Movement ID" mono value={movement.id} />
              <InfoField
                label="Reference type"
                value={humaniseMovementToken(movement.referenceType, "Manual")}
              />
              <InfoField label="Reference number" mono value={movement.referenceNumber ?? "None"} />
              <InfoField label="Created by" value={movement.createdByUserName} />
              <InfoField
                label="Created at"
                numeric
                value={formatMovementDateTime(movement.createdAt)}
              />
            </div>

            {movement.reversedMovementId ? (
              <div className="rounded-lg border border-warning/30 bg-warning-tint p-4">
                <p className="text-cell font-medium">Reversal</p>
                <p className="mt-1 break-words font-mono text-cell text-foreground-muted">
                  {movement.reversedMovementId}
                </p>
                <Button asChild className="mt-3" size="sm" type="button" variant="outline">
                  <Link href={`${MOVEMENT_DETAIL_BASE_PATH}/${movement.reversedMovementId}`}>
                    Open related movement
                  </Link>
                </Button>
              </div>
            ) : null}

            <div>
              <Button asChild type="button" variant="outline">
                <Link href={`/inventory/audit/${movement.inventoryItemId}`}>
                  Audit this item&apos;s ledger
                </Link>
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
