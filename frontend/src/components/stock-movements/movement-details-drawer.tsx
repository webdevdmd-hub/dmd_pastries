"use client";

import { ArrowUpRight, RotateCcw } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";
import { useState } from "react";

import {
  DEFAULT_MOVEMENT_DETAIL_TAB,
  MOVEMENT_DETAIL_BASE_PATH,
  type MovementDetailTabKey,
} from "@/components/stock-movements/movement-detail-tabs";
import { MovementDetailsPanel } from "@/components/stock-movements/movement-details-panel";
import { MovementDirectionBadge } from "@/components/stock-movements/movement-direction-badge";
import { MovementTypeBadge } from "@/components/stock-movements/movement-type-badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { StockMovement } from "@/types/stock-movements";

type MovementDetailsDrawerProps = {
  /** Whether the viewer may reverse this row. The host owns the eligibility
   *  rules; this only decides whether the button is offered. */
  canReverse: boolean;
  movement: StockMovement | null;
  onOpenChange: (open: boolean) => void;
  /** Closes the drawer and opens the host's reversal dialog. */
  onReverse: (movement: StockMovement) => void;
  open: boolean;
};

/**
 * A ledger row, over the ledger.
 *
 * The tab state is in memory, not in the URL: a `router.replace` here would
 * remount the page segment about a second later and Radix would dismiss the
 * sheet. The full page is the URL-addressable copy, and its link is in the
 * header.
 */
export function MovementDetailsDrawer({
  canReverse,
  movement,
  onOpenChange,
  onReverse,
  open,
}: MovementDetailsDrawerProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<MovementDetailTabKey>(DEFAULT_MOVEMENT_DETAIL_TAB);

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl" side="right">
        {movement ? (
          // Keyed by movement: opening a different row resets the tab rather
          // than landing on Costing because that is where the last one was left.
          <div className="grid min-w-0 gap-6" key={movement.id}>
            <SheetHeader className="space-y-0 p-0">
              <SheetTitle className="text-section">{movement.itemName}</SheetTitle>
              <SheetDescription className="sr-only">
                Stock ledger entry, costing and audit trail.
              </SheetDescription>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <MovementTypeBadge type={movement.movementType} />
                <MovementDirectionBadge direction={movement.movementDirection} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" type="button" variant="outline">
                  <Link href={`${MOVEMENT_DETAIL_BASE_PATH}/${movement.id}`}>
                    <ArrowUpRight className="h-4 w-4" />
                    Open full page
                  </Link>
                </Button>
                {canReverse ? (
                  <Button
                    onClick={() => onReverse(movement)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reverse movement
                  </Button>
                ) : null}
              </div>
            </SheetHeader>

            <MovementDetailsPanel
              activeTab={activeTab}
              movement={movement}
              onTabChange={setActiveTab}
            />
          </div>
        ) : (
          // Radix requires a title on every open sheet, including this one.
          <SheetHeader>
            <SheetTitle className="sr-only">Stock movement</SheetTitle>
            <SheetDescription>No movement selected.</SheetDescription>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}
