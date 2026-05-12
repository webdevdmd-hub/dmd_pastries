"use client";

import { Building2, Check, FileClock, GitBranch, LogOut, Settings2, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, type JSX } from "react";
import { toast } from "sonner";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { ThemeSelector } from "@/components/theme/theme-selector";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useBranches } from "@/hooks/use-branches";
import { useBusinessProfile, useOnboardingStatus, useSwitchBranch } from "@/hooks/use-business";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api/client";

function initials(fullName: string): string {
  return fullName
    .split(" ")
    .map((segment) => segment[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatSegment(segment: string): string {
  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function AppHeader(): JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, refreshProfile, user } = useAuth();
  const branchScope = useBranchScope();
  const { hasAnyPermission, hasPermission } = usePermission();
  const segments = pathname.split("/").filter(Boolean);
  const canViewAuditLogs = hasAnyPermission([PERMISSIONS.auditLogsView]);
  const canViewSettings = hasPermission(PERMISSIONS.settingsView);
  const canViewBranches = hasAnyPermission([
    PERMISSIONS.branchesView,
    PERMISSIONS.branchesAccessManage,
    PERMISSIONS.settingsView,
  ]);
  const businessQuery = useBusinessProfile(canViewSettings);
  const canUseBranchSwitcher =
    canViewBranches &&
    (canViewSettings ||
      user?.canAccessAllBranches === true ||
      hasPermission(PERMISSIONS.branchesSwitch) ||
      (user?.allowedBranchIds.length ?? 0) > 1);
  const branchesQuery = useBranches(canUseBranchSwitcher);
  const onboardingQuery = useOnboardingStatus(canViewSettings);
  const switchBranchMutation = useSwitchBranch();
  const currentBranchId =
    branchScope.effectiveBranchId ?? onboardingQuery.data?.currentBranchId ?? null;
  const branchOptions =
    branchesQuery.data?.filter((branch) => {
      const branchIsAllowed =
        branchScope.canAccessAllBranches || branchScope.isBranchAllowed(branch.id);
      return branch.status === "active" && branchIsAllowed;
    }) ??
    (branchScope.effectiveBranchId
      ? [
          {
            code: branchScope.effectiveBranchId,
            id: branchScope.effectiveBranchId,
            name: branchScope.effectiveBranchName ?? "Branch name unavailable",
          },
        ]
      : []);

  const handleLogout = async (): Promise<void> => {
    await logout();
    toast.success("You have been signed out.");
    router.replace(ROUTES.login);
  };

  const handleSwitchBranch = async (branchId: string, branchName: string): Promise<void> => {
    try {
      await switchBranchMutation.mutateAsync({ branchId });
      await refreshProfile();
      toast.success(`Switched to ${branchName}.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <header className="sticky top-0 z-20 border-b border-brand-cappuccino/70 bg-brand-latte/80 backdrop-blur-md">
      <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="lg:hidden">
              <AppSidebar />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-brand-mocha/70">Operations</p>
              <p className="text-sm font-medium text-brand-espresso">
                {businessQuery.data?.businessName ?? user?.businessName ?? "Business workspace"}
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="h-auto rounded-2xl px-3 py-2" variant="outline">
                <Avatar className="h-9 w-9">
                  <AvatarFallback>{initials(user?.fullName ?? "PP")}</AvatarFallback>
                </Avatar>
                <div className="hidden text-left sm:block">
                  <p className="text-sm font-semibold">{user?.fullName ?? "Pastries POS"}</p>
                  <p className="text-xs text-brand-mocha">{user?.email ?? "Signed-in user"}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>
                <p className="font-semibold text-brand-espresso">
                  {user?.fullName ?? "Signed-in user"}
                </p>
                <p className="mt-1 text-xs font-normal text-brand-mocha">
                  {user?.email ?? "No email available"}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={ROUTES.profile}>
                  <UserRound className="h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={ROUTES.onboarding}>
                  <Building2 className="h-4 w-4" />
                  Business onboarding
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={ROUTES.settings}>
                  <Settings2 className="h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              {canViewAuditLogs ? (
                <DropdownMenuItem asChild>
                  <Link href={ROUTES.auditLogs}>
                    <FileClock className="h-4 w-4" />
                    Audit logs
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {canUseBranchSwitcher ? (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <GitBranch className="mr-2 h-4 w-4" />
                    Switch branch
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-64">
                    {branchesQuery.isLoading ? (
                      <DropdownMenuItem disabled>Loading branches...</DropdownMenuItem>
                    ) : null}
                    {branchesQuery.error ? (
                      <DropdownMenuItem disabled>
                        {getErrorMessage(branchesQuery.error)}
                      </DropdownMenuItem>
                    ) : null}
                    {branchOptions.map((branch) => (
                      <DropdownMenuItem
                        disabled={switchBranchMutation.isPending || currentBranchId === branch.id}
                        key={branch.id}
                        onClick={() => void handleSwitchBranch(branch.id, branch.name)}
                      >
                        <span className="flex flex-1 flex-col">
                          <span>{branch.name}</span>
                          <span className="text-xs text-brand-mocha">{branch.code}</span>
                        </span>
                        {currentBranchId === branch.id ? <Check className="h-4 w-4" /> : null}
                      </DropdownMenuItem>
                    ))}
                    {branchOptions.length === 0 ? (
                      <DropdownMenuItem disabled>No active branches</DropdownMenuItem>
                    ) : null}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ) : null}
              <ThemeSelector />
              <DropdownMenuItem onClick={() => void handleLogout()}>
                <LogOut className="h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Separator />

        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href={ROUTES.dashboard}>Home</BreadcrumbLink>
            </BreadcrumbItem>
            {segments.map((segment, index) => {
              const href = `/${segments.slice(0, index + 1).join("/")}`;
              const isLast = index === segments.length - 1;

              return (
                <Fragment key={`${href}-group`}>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage>{formatSegment(segment)}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink href={href}>{formatSegment(segment)}</BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  );
}
