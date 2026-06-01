import type { JSX } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProductionBatchPackaging } from "@/types/manufacturing";

export function BatchPackagingSection({
  packaging,
}: {
  packaging: ProductionBatchPackaging[];
}): JSX.Element {
  return (
    <Card className="bg-white/85">
      <CardHeader>
        <CardTitle>Packaging</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Packaging</TableHead>
              <TableHead>Required</TableHead>
              <TableHead>Consumed</TableHead>
              <TableHead>Unit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {packaging.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-semibold text-brand-espresso">
                  {item.packagingName}
                </TableCell>
                <TableCell>{item.requiredQuantity}</TableCell>
                <TableCell>{item.consumedQuantity}</TableCell>
                <TableCell>{item.unitSymbol || item.unitName}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
