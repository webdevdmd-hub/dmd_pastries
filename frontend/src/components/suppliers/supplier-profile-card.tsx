"use client";

import { Globe, Mail, MapPin, Phone } from "lucide-react";
import type { JSX } from "react";

import { SupplierStatusBadge } from "@/components/suppliers/supplier-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Supplier } from "@/types/supplier";

function formatDate(value: string): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value))
    : "Not recorded";
}

function addressText(supplier: Supplier): string {
  const parts = [
    supplier.addressLine1,
    supplier.addressLine2,
    supplier.city,
    supplier.state,
    supplier.country,
    supplier.postalCode,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  return parts.length > 0 ? parts.join(", ") : "No address recorded.";
}

function ProfileRow({
  icon,
  label,
  value,
}: {
  icon: JSX.Element;
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="flex gap-3 rounded-2xl border border-brand-cappuccino bg-brand-latte/60 p-4">
      <div className="text-brand-mocha">{icon}</div>
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-brand-mocha">{label}</p>
        <p className="mt-1 text-sm font-semibold text-brand-espresso">{value}</p>
      </div>
    </div>
  );
}

export function SupplierProfileCard({ supplier }: { supplier: Supplier }): JSX.Element {
  return (
    <Card className="bg-white/80">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Supplier profile</CardTitle>
            <p className="mt-1 text-sm text-brand-mocha">{supplier.supplierCode}</p>
          </div>
          <SupplierStatusBadge status={supplier.status} />
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {supplier.status === "blocked" ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            This supplier is blocked and should not be used for purchasing workflows.
          </div>
        ) : null}
        <ProfileRow
          icon={<Phone className="h-4 w-4" />}
          label="Phone"
          value={supplier.phone ?? "Not set"}
        />
        <ProfileRow
          icon={<Mail className="h-4 w-4" />}
          label="Email"
          value={supplier.email ?? "Not set"}
        />
        <ProfileRow
          icon={<Globe className="h-4 w-4" />}
          label="Website"
          value={supplier.website ?? "Not set"}
        />
        <ProfileRow
          icon={<MapPin className="h-4 w-4" />}
          label="Address"
          value={addressText(supplier)}
        />
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-brand-cappuccino bg-brand-latte/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-brand-mocha">Category</p>
            <p className="mt-1 font-semibold text-brand-espresso">
              {supplier.supplierCategoryName ?? "Uncategorized"}
            </p>
          </div>
          <div className="rounded-2xl border border-brand-cappuccino bg-brand-latte/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-brand-mocha">Tax number</p>
            <p className="mt-1 font-semibold text-brand-espresso">
              {supplier.taxNumber ?? "Not set"}
            </p>
          </div>
          <div className="rounded-2xl border border-brand-cappuccino bg-brand-latte/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-brand-mocha">Created</p>
            <p className="mt-1 font-semibold text-brand-espresso">
              {formatDate(supplier.createdAt)}
            </p>
          </div>
          <div className="rounded-2xl border border-brand-cappuccino bg-brand-latte/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-brand-mocha">Updated</p>
            <p className="mt-1 font-semibold text-brand-espresso">
              {formatDate(supplier.updatedAt)}
            </p>
          </div>
        </div>
        {supplier.notes ? (
          <div className="rounded-2xl border border-brand-cappuccino bg-brand-latte/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-brand-mocha">Notes</p>
            <p className="mt-2 text-sm leading-6 text-brand-espresso">{supplier.notes}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
