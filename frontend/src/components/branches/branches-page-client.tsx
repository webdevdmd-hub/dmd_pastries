"use client";

import { Plus, Store } from "lucide-react";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { BranchFormDialog } from "@/components/branches/branch-form-dialog";
import { BranchesEmptyState } from "@/components/branches/branches-empty-state";
import { BranchesErrorState } from "@/components/branches/branches-error-state";
import { BranchesTable } from "@/components/branches/branches-table";
import { BranchesTableSkeleton } from "@/components/branches/branches-table-skeleton";
import { FilteredState } from "@/components/shared/collection-state";
import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PERMISSIONS } from "@/constants/permissions";
import { useAuth } from "@/hooks/use-auth";
import {
  useBranches,
  useCreateBranch,
  useUpdateBranch,
  useUpdateBranchStatus,
} from "@/hooks/use-branches";
import { usePermission } from "@/hooks/use-permission";
import { useUsers } from "@/hooks/use-users";
import { getErrorMessage } from "@/lib/api/client";
import type { Branch, BranchStatus, CreateBranchPayload } from "@/types/branch";
import type { User } from "@/types/user";

function filterBranches(branches: Branch[], search: string): Branch[] {
  const query = search.trim().toLowerCase();

  if (!query) {
    return branches;
  }

  return branches.filter((branch) =>
    [branch.name, branch.code, branch.address, branch.phone, branch.email, branch.managerUserId]
      .filter((value): value is string => typeof value === "string")
      .some((value) => value.toLowerCase().includes(query)),
  );
}

function isManagerRole(user: User): boolean {
  const roleName = user.roleName.toLowerCase();

  return (
    user.status === "active" &&
    (roleName.includes("manager") || roleName.includes("admin") || roleName.includes("owner"))
  );
}

export function BranchesPageClient(): JSX.Element {
  const { refreshProfile } = useAuth();
  const { hasAnyPermission, hasPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.branchesView, PERMISSIONS.settingsView]);
  const canManage = hasAnyPermission([
    PERMISSIONS.branchesCreate,
    PERMISSIONS.branchesEdit,
    PERMISSIONS.branchesStatusUpdate,
    PERMISSIONS.branchesAccessManage,
  ]);
  const canViewUsers = hasPermission(PERMISSIONS.usersView);
  const branchesQuery = useBranches(canView);
  const usersQuery = useUsers({ search: "", status: "all" }, canManage && canViewUsers);
  const createBranchMutation = useCreateBranch();
  const updateBranchMutation = useUpdateBranch();
  const updateBranchStatusMutation = useUpdateBranchStatus();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

  const isSearching = search.trim().length > 0;
  const branches = useMemo(
    () => filterBranches(branchesQuery.data ?? [], search),
    [branchesQuery.data, search],
  );
  const managerOptions = useMemo(
    () => (canManage && canViewUsers ? (usersQuery.data ?? []).filter(isManagerRole) : []),
    [canManage, canViewUsers, usersQuery.data],
  );

  const isSubmitting = createBranchMutation.isPending || updateBranchMutation.isPending;

  const openCreateDialog = (): void => {
    setSelectedBranch(null);
    setDialogOpen(true);
  };

  const openEditDialog = (branch: Branch): void => {
    setSelectedBranch(branch);
    setDialogOpen(true);
  };

  const handleSubmit = async (payload: CreateBranchPayload): Promise<void> => {
    try {
      if (selectedBranch) {
        await updateBranchMutation.mutateAsync({
          id: selectedBranch.id,
          payload,
        });
        await refreshProfile();
        toast.success("Branch updated.");
      } else {
        await createBranchMutation.mutateAsync(payload);
        await refreshProfile();
        toast.success("Branch created.");
      }

      setDialogOpen(false);
      setSelectedBranch(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleStatusChange = async (branch: Branch, status: BranchStatus): Promise<void> => {
    try {
      await updateBranchStatusMutation.mutateAsync({
        id: branch.id,
        payload: { status },
      });
      await refreshProfile();
      toast.success(`Branch marked ${status}.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  if (!canView) {
    return (
      <div className="mx-auto max-w-3xl">
        <Alert className="border-brand-cappuccino bg-card/80">
          <Store className="h-4 w-4" />
          <AlertTitle>Access denied</AlertTitle>
          <AlertDescription>
            You need settings.view permission to view branch management.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Branch Management"
        description="Manage business locations, branch contact details, and branch availability for staff assignment."
        actions={
          canManage ? (
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              Create Branch
            </Button>
          ) : null
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <Input
            aria-label="Search branches"
            className="md:max-w-md"
            placeholder="Search by name, code, address, manager, phone, or email"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
          />
          <p className="text-sm text-brand-mocha">
            {branches.length} visible of {branchesQuery.data?.length ?? 0} branches
          </p>
        </CardContent>
      </Card>

      {branchesQuery.isLoading ? <BranchesTableSkeleton /> : null}

      {branchesQuery.error ? (
        <BranchesErrorState
          description={getErrorMessage(branchesQuery.error)}
          onRetry={() => {
            void branchesQuery.refetch();
          }}
        />
      ) : null}

      {/* Two different situations. Searching a tenant that HAS branches used to
          render "No branches yet" directly under "0 visible of 1 branches" — the
          screen contradicting itself, with no way back but clearing the box by
          hand. */}
      {!branchesQuery.isLoading && !branchesQuery.error && branches.length === 0 ? (
        isSearching ? (
          <FilteredState
            noun="branches"
            onClearFilters={() => {
              setSearch("");
            }}
            query={search}
            totalCount={branchesQuery.data?.length ?? 0}
          />
        ) : (
          <BranchesEmptyState />
        )
      ) : null}

      {!branchesQuery.isLoading && !branchesQuery.error && branches.length > 0 ? (
        <BranchesTable
          branches={branches}
          canManage={canManage}
          managerUsers={managerOptions}
          onEdit={openEditDialog}
          onStatusChange={(branch, status) => {
            void handleStatusChange(branch, status);
          }}
        />
      ) : null}

      <BranchFormDialog
        branch={selectedBranch}
        isSubmitting={isSubmitting}
        managerOptions={managerOptions}
        mode={selectedBranch ? "edit" : "create"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
