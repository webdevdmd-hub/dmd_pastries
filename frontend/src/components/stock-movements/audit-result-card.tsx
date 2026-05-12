import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";
import type { AuditResult } from "@/types/stock-movements";

type AuditResultCardProps = {
  audit: AuditResult;
};

function formatQuantity(value: number): string {
  return new Intl.NumberFormat("en-AE", { maximumFractionDigits: 3 }).format(value);
}

export function AuditResultCard({ audit }: AuditResultCardProps): JSX.Element {
  return (
    <Card
      className={
        audit.isBalanced ? "border-emerald-200 bg-emerald-50/70" : "border-red-200 bg-red-50/70"
      }
    >
      <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          {audit.isBalanced ? (
            <CheckCircle2 className="mt-1 h-7 w-7 text-emerald-800" />
          ) : (
            <AlertTriangle className="mt-1 h-7 w-7 text-red-800" />
          )}
          <div>
            <h2 className="text-xl font-bold text-brand-espresso">
              {audit.isBalanced ? "Inventory ledger is balanced" : "Inventory mismatch detected"}
            </h2>
            <p className="mt-1 text-sm text-brand-mocha">
              Difference: {formatQuantity(audit.difference)} across {audit.movementCount} movement
              records.
            </p>
            {!audit.isBalanced ? (
              <p className="mt-2 text-sm text-red-900">
                Investigate stock movements or perform a controlled adjustment.
              </p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
