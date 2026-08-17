"use client";

import {
  Building2,
  Database,
  Gauge,
  LogOut,
  ShieldCheck,
  Stethoscope,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSX, ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";

type SuperAdminShellProps = {
  children: ReactNode;
};

const superAdminItems = [
  { href: ROUTES.superAdmin, icon: Gauge, label: "Overview" },
  { href: `${ROUTES.superAdmin}/businesses`, icon: Building2, label: "Businesses" },
  { href: `${ROUTES.superAdmin}/users`, icon: UsersRound, label: "Users" },
  { href: `${ROUTES.superAdmin}/diagnostics`, icon: Stethoscope, label: "Diagnostics" },
  { href: `${ROUTES.superAdmin}/tables`, icon: Database, label: "Table Explorer" },
] as const;

export function SuperAdminShell({ children }: SuperAdminShellProps): JSX.Element {
  const router = useRouter();
  const { logout, user } = useAuth();

  const handleLogout = async (): Promise<void> => {
    await logout();
    toast.success("You have been signed out.");
    router.replace(ROUTES.login);
  };

  return (
    <div className="min-h-screen bg-canvas text-brand-espresso">
      <header className="border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-caramel text-brand-espresso">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold text-brand-cappuccino">Platform Control</p>
              <h1 className="text-lg font-semibold">Super Admin</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-card/15 px-3 py-2 text-sm text-primary-foreground/80">
              {user?.email ?? "Platform admin"}
            </span>
            <Button
              className="border-card/15 bg-card/5 text-primary-foreground hover:bg-card/10"
              onClick={() => {
                void handleLogout();
              }}
              type="button"
              variant="outline"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-8">
        <aside className="h-fit border-b border-border pb-4 lg:sticky lg:top-6 lg:border-b-0 lg:pb-0">
          <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {superAdminItems.map((item) => (
              <Link
                className="flex min-w-fit items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground-muted hover:bg-card hover:text-brand-espresso"
                href={item.href}
                key={item.href}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
