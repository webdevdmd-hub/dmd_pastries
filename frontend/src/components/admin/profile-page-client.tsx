"use client";

import { Building2, KeyRound, MailCheck, UserRound } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { useBusinessProfile, useBusinessSettings } from "@/hooks/use-business";
import { usePermission } from "@/hooks/use-permission";

export function ProfilePageClient(): JSX.Element {
  const { user } = useAuth();
  const { hasPermission } = usePermission();
  const canViewSettings = hasPermission(PERMISSIONS.settingsView);
  const businessQuery = useBusinessProfile(canViewSettings);
  const settingsQuery = useBusinessSettings(canViewSettings);
  const business = businessQuery.data;
  const settings = settingsQuery.data;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="Account Profile"
        description="Review signed-in account details, verification status, and security actions prepared for production."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardDescription>Signed-in user</CardDescription>
            <CardTitle className="font-serif text-3xl">{user?.fullName ?? "User"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-3xl border border-brand-cappuccino bg-brand-latte/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-brand-mocha">Email</p>
              <p className="mt-2 font-medium text-brand-espresso">{user?.email ?? "Unavailable"}</p>
            </div>
            <div className="rounded-3xl border border-brand-cappuccino bg-brand-latte/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-brand-mocha">Business</p>
              <p className="mt-2 font-medium text-brand-espresso">
                {business?.businessName ?? user?.businessName ?? "Business workspace"}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-brand-cappuccino bg-brand-latte/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-mocha">Currency</p>
                <p className="mt-2 font-medium text-brand-espresso">
                  {business?.currency ?? (canViewSettings ? "Loading" : "Restricted")}
                </p>
              </div>
              <div className="rounded-3xl border border-brand-cappuccino bg-brand-latte/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-mocha">Timezone</p>
                <p className="mt-2 font-medium text-brand-espresso">
                  {business?.timezone ?? (canViewSettings ? "Loading" : "Restricted")}
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-brand-cappuccino bg-brand-latte/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-mocha">VAT/TRN</p>
                <p className="mt-2 font-medium text-brand-espresso">
                  {business?.vatNumber ?? "Not set"}
                </p>
              </div>
              <div className="rounded-3xl border border-brand-cappuccino bg-brand-latte/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-mocha">Default tax</p>
                <p className="mt-2 font-medium text-brand-espresso">
                  {settings
                    ? `${String(settings.defaultTaxRate)}%`
                    : canViewSettings
                      ? "Loading"
                      : "Restricted"}
                </p>
              </div>
            </div>
            <div className="rounded-3xl border border-brand-cappuccino bg-brand-latte/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-brand-mocha">Roles</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(user?.roles.length ? user.roles : ["Assigned role unavailable"]).map((role) => (
                  <Badge key={role} variant="secondary">
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <div className="mb-2 rounded-2xl bg-brand-cappuccino/50 p-3 text-brand-mocha">
                <MailCheck className="h-5 w-5" />
              </div>
              <CardTitle>Email verification</CardTitle>
              <CardDescription>
                Appwrite verification is wired through the existing verification page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant={user?.emailVerified ? "outline" : "default"}>
                <Link href={ROUTES.verifyEmail}>
                  {user?.emailVerified ? "Review verification" : "Verify email"}
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="mb-2 rounded-2xl bg-brand-cappuccino/50 p-3 text-brand-mocha">
                <KeyRound className="h-5 w-5" />
              </div>
              <CardTitle>Password recovery</CardTitle>
              <CardDescription>
                Password reset is handled by Appwrite recovery links and should be tested end-to-end
                with your production Appwrite domain.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href={ROUTES.forgotPassword}>Reset password</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="mb-2 flex gap-2 text-brand-mocha">
                <UserRound className="h-5 w-5" />
                <Building2 className="h-5 w-5" />
              </div>
              <CardTitle>Profile editing</CardTitle>
              <CardDescription>
                Business profile and settings APIs are connected. Full edit forms can now be built
                on top of these contracts.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
}
