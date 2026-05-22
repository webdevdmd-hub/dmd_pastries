import { usePathname } from "next/navigation";
import type { JSX, ReactNode } from "react";

import { AppHeader } from "@/components/layout/app-header";
import { DesktopSidebar } from "@/components/layout/desktop-sidebar";

type DashboardShellProps = {
  children: ReactNode;
};

export function DashboardShell({ children }: DashboardShellProps): JSX.Element {
  const pathname = usePathname();
  const isPosRoute = pathname === "/pos" || pathname.startsWith("/pos/");

  return (
    <div className="min-h-screen bg-workspace-canvas text-brand-espresso">
      <div className="flex min-h-screen">
        <DesktopSidebar />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          {isPosRoute ? null : <AppHeader />}
          <main className={isPosRoute ? "flex-1 p-0" : "flex-1 px-4 py-6 sm:px-6 lg:px-8"}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
