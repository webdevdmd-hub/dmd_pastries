"use client";

import type { JSX } from "react";

import { SUPPLIER_STATUS_COPY } from "@/components/suppliers/supplier-status-copy";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PAYMENT_TERMS_LABEL, type Supplier } from "@/types/supplier";

/** "3 days" reads; a bare "3" under a heading called Lead time does not. */
function leadTimeText(days: number | null): string {
  if (days === null) return "";
  if (days === 0) return "Same day";
  return days === 1 ? "1 day" : `${String(days)} days`;
}

function formatDate(value: string): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value))
    : "";
}

function addressText(supplier: Supplier): string {
  return [
    supplier.addressLine1,
    supplier.addressLine2,
    supplier.city,
    supplier.state,
    supplier.country,
    supplier.postalCode,
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(", ");
}

/**
 * One field of the profile.
 *
 * An absent value renders as a muted em-dash, not "Not set" in body colour.
 * Four "Not set"s at full contrast read as content and compete with the values
 * that are actually there; the eye should be able to skip them.
 */
function Field({
  label,
  value,
  mono,
  needed,
}: {
  label: string;
  value: string;
  mono?: boolean;
  /**
   * True for the fields a purchase order actually needs. Absent-and-optional
   * gets a muted dash; absent-and-needed gets a warning chip, because those are
   * different problems and only one of them is worth acting on.
   */
  needed?: boolean;
}): JSX.Element {
  const empty = value.length === 0;

  return (
    <div className="grid gap-1">
      <dt className="text-meta text-foreground-muted">{label}</dt>
      <dd
        className={[
          "text-cell",
          mono ? "font-mono" : "",
          empty ? "text-foreground-muted" : "tabular-nums",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {empty ? needed ? <Badge variant="warning">Needed for POs</Badge> : "—" : value}
      </dd>
    </div>
  );
}

export function SupplierProfileCard({ supplier }: { supplier: Supplier }): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {supplier.status === "blocked" ? (
          <div className="rounded-lg bg-danger-tint p-4 text-cell text-danger-text">
            This supplier is blocked. {SUPPLIER_STATUS_COPY.blocked.summary} Bills already posted
            can still be paid.
          </div>
        ) : null}

        {supplier.status === "inactive" ? (
          <div className="rounded-lg bg-muted p-4 text-cell text-foreground-muted">
            This supplier is inactive. {SUPPLIER_STATUS_COPY.inactive.summary}
          </div>
        ) : null}

        {/* Purchasing terms lead, because they are what a buyer opens this page
            to find. Everything below is reference detail. */}
        <dl className="grid gap-4 rounded-lg bg-muted p-4 sm:grid-cols-3">
          <Field
            label="Payment terms"
            needed
            value={supplier.paymentTerms === "" ? "" : PAYMENT_TERMS_LABEL[supplier.paymentTerms]}
          />
          <Field label="Lead time" needed value={leadTimeText(supplier.leadTimeDays)} />
          <div className="grid gap-1">
            <dt className="text-meta text-foreground-muted">Preferred supplier</dt>
            <dd className="text-cell">
              {supplier.isPreferred ? (
                <Badge variant="info">Preferred</Badge>
              ) : (
                <span className="text-foreground-muted">No</span>
              )}
            </dd>
          </div>
        </dl>

        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Supplier code" mono value={supplier.supplierCode} />
          <Field label="Status" value={SUPPLIER_STATUS_COPY[supplier.status].label} />
          <Field label="Phone" value={supplier.phone ?? ""} />
          <Field label="Email" value={supplier.email ?? ""} />
          <Field label="Website" value={supplier.website ?? ""} />
          <Field label="Tax number / TRN" value={supplier.taxNumber ?? ""} />
          <Field label="Created" value={formatDate(supplier.createdAt)} />
          <Field label="Updated" value={formatDate(supplier.updatedAt)} />
        </dl>

        <div className="grid gap-1">
          <dt className="text-meta text-foreground-muted">Address</dt>
          <dd
            className={
              addressText(supplier).length === 0 ? "text-cell text-foreground-muted" : "text-cell"
            }
          >
            {addressText(supplier).length === 0 ? "—" : addressText(supplier)}
          </dd>
        </div>

        {supplier.notes ? (
          <div className="grid gap-1 rounded-lg bg-muted p-4">
            <p className="text-meta text-foreground-muted">Internal notes</p>
            <p className="text-cell">{supplier.notes}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
