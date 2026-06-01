import type { JSX } from "react";

import { CustomerStatusBadge } from "@/components/customers/customer-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Customer } from "@/types/customer";

function line(value: string | null): string {
  return value && value.length > 0 ? value : "Not set";
}

export function CustomerProfileCard({ customer }: { customer: Customer }): JSX.Element {
  const address = [customer.addressLine1, customer.addressLine2, customer.city, customer.country]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(", ");

  return (
    <Card className="bg-white/80">
      <CardHeader>
        <CardTitle>Customer profile</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm md:grid-cols-2">
        <div>
          <p className="text-brand-mocha">Phone</p>
          <p className="font-semibold text-brand-espresso">{line(customer.phone)}</p>
        </div>
        <div>
          <p className="text-brand-mocha">Email</p>
          <p className="font-semibold text-brand-espresso">{line(customer.email)}</p>
        </div>
        <div>
          <p className="text-brand-mocha">Gender</p>
          <p className="font-semibold capitalize text-brand-espresso">
            {customer.gender?.replaceAll("_", " ") ?? "Not set"}
          </p>
        </div>
        <div>
          <p className="text-brand-mocha">Date of birth</p>
          <p className="font-semibold text-brand-espresso">{line(customer.dateOfBirth)}</p>
        </div>
        <div className="md:col-span-2">
          <p className="text-brand-mocha">Address</p>
          <p className="font-semibold text-brand-espresso">{address || "Not set"}</p>
        </div>
        <div>
          <p className="text-brand-mocha">Status</p>
          <div className="mt-1">
            <CustomerStatusBadge status={customer.status} />
          </div>
        </div>
        <div>
          <p className="text-brand-mocha">Created</p>
          <p className="font-semibold text-brand-espresso">
            {customer.createdAt
              ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(
                  new Date(customer.createdAt),
                )
              : "Not set"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
