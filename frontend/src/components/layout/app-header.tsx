"use client";

import {
  Building2,
  Check,
  FileClock,
  GitBranch,
  LogOut,
  MapPin,
  Settings2,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, type JSX } from "react";
import { toast } from "sonner";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { useBreadcrumbLabel } from "@/components/layout/breadcrumb-label";
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Record identifiers must never be humanised into a fake title — a bill at
 * `/purchasing/invoices/{uuid}` would otherwise read as
 * "E4c93786 5eb5 4fa2 A52b 8e940950e70" in the breadcrumb.
 */
function isRecordIdSegment(segment: string): boolean {
  return UUID_PATTERN.test(segment) || /^\d+$/.test(segment) || /^[0-9a-f]{16,}$/i.test(segment);
}

export function AppHeader(): JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, refreshProfile, user } = useAuth();
  const branchScope = useBranchScope();
  const { hasAnyPermission, hasPermission } = usePermission();
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbLabel = useBreadcrumbLabel();
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
  const currentBranchDisplayName =
    branchScope.effectiveBranchName ??
    branchesQuery.data?.find((branch) => branch.id === currentBranchId)?.name ??
    (branchScope.canAccessAllBranches && !currentBranchId
      ? "All branches"
      : currentBranchId
        ? "Branch name unavailable"
        : "No branch assigned");
  const currentBranchDisplayLabel =
    branchScope.canAccessAllBranches && !currentBranchId ? "Branch scope" : "Active branch";
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
    <header className="sticky top-0 z-20 border-b border-workspace-border bg-workspace-panel/95 backdrop-blur-xl">
      <div className="flex flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-h-12 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="lg:hidden">
              <AppSidebar />
            </div>
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-workspace-muted">
                Operations
              </p>
              <p className="text-sm font-semibold text-brand-espresso">
                {businessQuery.data?.businessName ?? user?.businessName ?? "Business workspace"}
              </p>
            </div>
          </div>

          <div className="hidden min-w-0 items-center gap-2 rounded-xl border border-workspace-border bg-workspace-panel px-3 py-2 text-left shadow-none md:flex">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-latte text-brand-caramel">
              <MapPin className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-workspace-muted">
                {currentBranchDisplayLabel}
              </span>
              <span className="block truncate text-sm font-semibold text-brand-espresso">
                {currentBranchDisplayName}
              </span>
            </span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="h-auto rounded-xl border-workspace-border bg-workspace-panel px-2.5 py-2 shadow-none hover:bg-brand-latte/70"
                variant="outline"
              >
                <Avatar className="h-8 w-8">
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

        <Breadcrumb className="text-xs">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href={ROUTES.dashboard}>Home</BreadcrumbLink>
            </BreadcrumbItem>
            {segments.map((segment, index) => {
              const href = `/${segments.slice(0, index + 1).join("/")}`;
              const isLast = index === segments.length - 1;
              // Show the record's business reference (bill no, order no) when the
              // page published one; never fall back to the raw identifier.
              const label = isRecordIdSegment(segment)
                ? ((isLast ? breadcrumbLabel : null) ?? "Details")
                : formatSegment(segment);

              return (
                <Fragment key={`${href}-group`}>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage>{label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink href={href}>{label}</BreadcrumbLink>
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
