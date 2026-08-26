"use client";

import { Star } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSX } from "react";

import { SupplierActionsMenu } from "@/components/suppliers/supplier-actions-menu";
import { SupplierStatusBadge } from "@/components/suppliers/supplier-status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/constants/routes";
import { PAYMENT_TERMS_LABEL, type Supplier } from "@/types/supplier";

/** The unit is on the screen: a bare "3" in a Terms cell means nothing. */
function leadTimeText(days: number | null): string {
  if (days === null) return "no lead time";
  if (days === 0) return "same day";
  return days === 1 ? "1 day lead" : `${String(days)} days lead`;
}

type SuppliersTableProps = {
  canManage: boolean;
  onDelete: (supplier: Supplier) => void;
  onEdit: (supplier: Supplier) => void;
  onStatusChange: (supplier: Supplier, status: Supplier["status"]) => void;
  suppliers: Supplier[];
};

/**
 * An absent optional value. Renders as a muted em-dash rather than the word
 * "Not set" at full contrast: four of those in a row read as content, and gave
 * a filled contact the same visual weight as a missing one.
 */
function Absent(): JSX.Element {
  return <span className="text-foreground-muted">&mdash;</span>;
}

function locationText(supplier: Supplier): string | null {
  const parts = [supplier.city, supplier.country].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );

  return parts.length > 0 ? parts.join(", ") : null;
}

export function SuppliersTable({
  canManage,
  onDelete,
  onEdit,
  onStatusChange,
  suppliers,
}: SuppliersTableProps): JSX.Element {
  const router = useRouter();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Supplier</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Terms</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Location</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {suppliers.map((supplier) => {
          const location = locationText(supplier);
          const contactName = supplier.primaryContact?.contactName ?? null;

          return (
            <TableRow key={supplier.id}>
              <TableCell>
                <Link className="grid gap-0.5" href={`${ROUTES.suppliers}/${supplier.id}`}>
                  <span className="flex items-center gap-1.5">
                    {supplier.isPreferred ? (
                      <Star
                        aria-label="Preferred supplier"
                        className="h-3.5 w-3.5 shrink-0 fill-current"
                        role="img"
                      />
                    ) : null}
                    <span className="font-medium">{supplier.supplierName}</span>
                  </span>
                  {/* Identifiers are mono and must never wrap mid-value. */}
                  <span className="whitespace-nowrap font-mono text-meta text-foreground-muted">
                    {supplier.supplierCode}
                  </span>
                </Link>
              </TableCell>

              {/* Contact and phone share a cell: two facts about one person, and
                  it buys back the width the 8-column layout did not have. */}
              <TableCell>
                {contactName === null && !supplier.phone ? (
                  <Absent />
                ) : (
                  <span className="grid gap-0.5">
                    <span>{contactName ?? <Absent />}</span>
                    {supplier.phone ? (
                      <span className="whitespace-nowrap text-meta tabular-nums text-foreground-muted">
                        {supplier.phone}
                      </span>
                    ) : null}
                  </span>
                )}
              </TableCell>

              {/* Terms replaced Email here. A buyer scanning this list is
                  deciding who to order from, and "when do I pay / when does it
                  arrive" decides that; the email is on the detail page. Absent
                  terms are a warning chip, not a dash, because a PO cannot be
                  costed without them. */}
              <TableCell>
                {supplier.paymentTerms === "" && supplier.leadTimeDays === null ? (
                  <Badge variant="warning">Not set</Badge>
                ) : (
                  <span className="grid gap-0.5">
                    <span className="whitespace-nowrap">
                      {supplier.paymentTerms === "" ? (
                        <Absent />
                      ) : (
                        PAYMENT_TERMS_LABEL[supplier.paymentTerms]
                      )}
                    </span>
                    <span className="whitespace-nowrap text-meta tabular-nums text-foreground-muted">
                      {leadTimeText(supplier.leadTimeDays)}
                    </span>
                  </span>
                )}
              </TableCell>

              {/* One badge per row, exceptions only: Active is the default state
                  of nearly every row, so badging it carries no information. */}
              <TableCell>
                {supplier.status === "active" ? (
                  <span className="sr-only">Active</span>
                ) : (
                  <SupplierStatusBadge status={supplier.status} />
                )}
              </TableCell>

              <TableCell className="whitespace-nowrap text-right">
                {location ?? <Absent />}
              </TableCell>

              <TableCell>
                <SupplierActionsMenu
                  canManage={canManage}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  onStatusChange={onStatusChange}
                  onView={(selectedSupplier) =>
                    router.push(`${ROUTES.suppliers}/${selectedSupplier.id}`)
                  }
                  supplier={supplier}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
