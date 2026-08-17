"use client";

import { AlertTriangle, Database, ShieldCheck, UsersRound } from "lucide-react";
import type { JSX } from "react";

import { LoadingState } from "@/components/shared/loading-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useSuperAdminProfile } from "@/hooks/use-super-admin";
import { getErrorMessage } from "@/lib/api/client";

const phaseCards = [
  {
    title: "Businesses",
    description: "Tenant list, business status, owner reassignment, subscription repair.",
    status: "Phase 2",
    icon: ShieldCheck,
  },
  {
    title: "Users",
    description: "User 360, Appwrite link, role, branch access, sessions, related data.",
    status: "Phase 2",
    icon: UsersRound,
  },
  {
    title: "Table Explorer",
    description: "Structured table CRUD, dependency scan, hard-delete confirmation.",
    status: "Phase 3",
    icon: Database,
  },
] as const;

export function SuperAdminOverview(): JSX.Element {
  const { user } = useAuth();
  const profileQuery = useSuperAdminProfile(user?.isPlatformAdmin === true);

  return (
    <div className="space-y-6">
      <section className="border-b border-border pb-6">
        <p className="text-sm font-semibold text-foreground-muted">Phase 1 Foundation</p>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-3xl font-semibold text-brand-espresso">Platform Super Admin</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground-muted">
              This area is isolated from tenant admin permissions and is available only to
              env-allowlisted Appwrite users.
            </p>
          </div>
          <span className="w-fit rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
            {user?.email ?? "Super Admin"}
          </span>
        </div>
      </section>

      {profileQuery.isLoading ? <LoadingState /> : null}

      {profileQuery.error ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Unable to verify Super Admin API access</AlertTitle>
          <AlertDescription>{getErrorMessage(profileQuery.error)}</AlertDescription>
        </Alert>
      ) : null}

      {profileQuery.data ? (
        <Alert className="border-money/30 bg-money-tint text-money-text">
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Super Admin access verified</AlertTitle>
          <AlertDescription>
            Backend `/api/v1/super-admin/me` accepted this Appwrite session as a platform admin.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {phaseCards.map((card) => (
          <Card className="border-border shadow-none" key={card.title}>
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-latte text-brand-caramel">
                  <card.icon className="h-5 w-5" />
                </span>
                <span className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground-muted">
                  {card.status}
                </span>
              </div>
              <CardTitle className="text-lg">{card.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-foreground-muted">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
