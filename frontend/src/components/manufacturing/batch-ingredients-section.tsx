import type { JSX } from "react";

import {
  AccountingJournalLink,
  StockMovementLink,
} from "@/components/shared/accounting-reference-links";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProductionBatchIngredient } from "@/types/manufacturing";

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    style: "currency",
  }).format(value);
}

export function BatchIngredientsSection({
  canManage,
  ingredients,
  onConsume,
}: {
  canManage: boolean;
  ingredients: ProductionBatchIngredient[];
  onConsume: () => void;
}): JSX.Element {
  return (
    <Card className="bg-white/85">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Ingredients</CardTitle>
        {canManage ? (
          <Button onClick={onConsume} type="button" variant="outline">
            Consume
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ingredient</TableHead>
              <TableHead>Required</TableHead>
              <TableHead>Consumed</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Wastage %</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Journal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ingredients.map((ingredient) => (
              <TableRow key={ingredient.id}>
                <TableCell className="font-semibold text-brand-espresso">
                  {ingredient.itemName}
                </TableCell>
                <TableCell>{ingredient.requiredQuantity}</TableCell>
                <TableCell>{ingredient.consumedQuantity}</TableCell>
                <TableCell>{ingredient.unitSymbol || ingredient.unitName}</TableCell>
                <TableCell>
                  <div>
                    <p>{formatMoney(ingredient.totalCost)}</p>
                    {ingredient.unitCostSnapshot > 0 ? (
                      <p className="text-xs text-brand-mocha">
                        Unit {formatMoney(ingredient.unitCostSnapshot)}
                      </p>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>{ingredient.wastagePercentage}%</TableCell>
                <TableCell>
                  <StockMovementLink id={ingredient.stockMovementId} />
                </TableCell>
                <TableCell>
                  <AccountingJournalLink id={ingredient.accountingJournalEntryId} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
