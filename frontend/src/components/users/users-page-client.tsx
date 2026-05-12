"use client";

import { ShieldAlert, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InviteUserDialog } from "@/components/users/invite-user-dialog";
import { PendingInvitationsPanel } from "@/components/users/pending-invitations-panel";
import {
  allBranchesFilterValue,
  unassignedBranchFilterValue,
  UserFilters,
} from "@/components/users/user-filters";
import { UserFormDialog } from "@/components/users/user-form-dialog";
import { UsersEmptyState } from "@/components/users/users-empty-state";
import { UsersErrorState } from "@/components/users/users-error-state";
import { UsersTable } from "@/components/users/users-table";
import { UsersTableSkeleton } from "@/components/users/users-table-skeleton";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useBranches } from "@/hooks/use-branches";
import {
  useCancelStaffInvitation,
  useCreateStaffInvitation,
  useResendStaffInvitation,
  useStaffInvitations,
} from "@/hooks/use-invitations";
import { useRoles } from "@/hooks/use-roles";
import {
  useAssignUserBranch,
  useCreateUser,
  useSoftDeleteUser,
  useUpdateUser,
  useUpdateUserStatus,
  useUsers,
} from "@/hooks/use-users";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import type { CreateStaffInvitationPayload, StaffInvitation } from "@/types/invitation";
import type { Permission } from "@/types/permission";
import type { Role } from "@/types/role";
import type {
  CreateUserPayload,
  UpdateUserPayload,
  User,
  UserFilters as UserFiltersType,
  UserFormMode,
  UserRoleOption,
  UserStatus,
} from "@/types/user";

function buildRoleOptions(users: User[]): UserRoleOption[] {
  const map = new Map<string, string>();

  users.forEach((user) => {
    if (!map.has(user.roleId)) {
      map.set(user.roleId, user.roleName);
    }
  });

  return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
}

function buildRoleOptionsFromRoles(roles: Role[]): UserRoleOption[] {
  return roles.map((role) => ({
    id: role.id,
    name: role.roleName,
  }));
}

function filterUsers(users: User[], filters: UserFiltersType): User[] {
  return users.filter((user) => {
    const matchesStatus = filters.status === "all" || user.status === filters.status;
    const branchFilter = filters.branchId ?? allBranchesFilterValue;
    const matchesBranch =
      branchFilter === allBranchesFilterValue ||
      (branchFilter === unassignedBranchFilterValue
        ? user.branchId === null
        : user.branchId === branchFilter);
    const searchValue = filters.search.trim().toLowerCase();

    if (!searchValue) {
      return matchesStatus && matchesBranch;
    }

    const haystacks = [user.fullName, user.email, user.phone, user.roleName, user.id].map((value) =>
      value.toLowerCase(),
    );

    return matchesStatus && matchesBranch && haystacks.some((value) => value.includes(searchValue));
  });
}

function hasAnyPermission(
  permissions: readonly Permission[] | undefined,
  requiredPermissions: readonly Permission[],
): boolean {
  return requiredPermissions.some((permission) => permissions?.includes(permission));
}

export function UsersPageClient(): JSX.Element {
  const router = useRouter();
  const { logout, refreshProfile, user } = useAuth();
  const branchScope = useBranchScope();
  const [filters, setFilters] = useState<UserFiltersType>({
    branchId: allBranchesFilterValue,
    search: "",
    status: "all",
  });
  const [dialogMode, setDialogMode] = useState<UserFormMode>("create");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [statusDialogState, setStatusDialogState] = useState<{
    nextStatus: UserStatus;
    user: User;
  } | null>(null);
  const [deleteDialogUser, setDeleteDialogUser] = useState<User | null>(null);
  const { data, error, isLoading, refetch } = useUsers(filters);
  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();
  const assignUserBranchMutation = useAssignUserBranch();
  const updateUserStatusMutation = useUpdateUserStatus();
  const deleteUserMutation = useSoftDeleteUser();
  const createInvitationMutation = useCreateStaffInvitation();
  const resendInvitationMutation = useResendStaffInvitation();
  const cancelInvitationMutation = useCancelStaffInvitation();
  const canAccessRolesEndpoint =
    (user?.permissions.includes(PERMISSIONS.rolesView) ?? false) ||
    (user?.permissions.includes(PERMISSIONS.rolesPermissionsView) ?? false) ||
    (user?.permissions.includes(PERMISSIONS.rolesPermissionsUpdate) ?? false);
  const rolesQuery = useRoles(canAccessRolesEndpoint);

  const canViewUsers = user?.permissions.includes(PERMISSIONS.usersView) ?? false;
  const canCreateUsers = hasAnyPermission(user?.permissions, [
    PERMISSIONS.usersCreate,
    PERMISSIONS.usersInvite,
  ]);
  const canEditUsers = hasAnyPermission(user?.permissions, [
    PERMISSIONS.usersEdit,
    PERMISSIONS.usersStatusUpdate,
  ]);
  const canDeleteUsers = user?.permissions.includes(PERMISSIONS.usersDelete) ?? false;
  const canViewSettings = hasAnyPermission(user?.permissions, [PERMISSIONS.settingsView]);
  const canAccessAllBranches = branchScope.canAccessAllBranches;
  const hasMultipleAllowedBranches = branchScope.allowedBranchIds.length > 1;
  const canLoadBranches = hasAnyPermission(user?.permissions, [
    PERMISSIONS.branchesView,
    PERMISSIONS.branchesCreate,
    PERMISSIONS.branchesEdit,
    PERMISSIONS.settingsView,
    PERMISSIONS.branchesAccessManage,
    PERMISSIONS.usersCreate,
    PERMISSIONS.usersEdit,
  ]);
  const branchesQuery = useBranches(canViewUsers && canLoadBranches);
  const invitationsQuery = useStaffInvitations("pending", canViewUsers);
  const canUseStaffBranchFilter =
    canLoadBranches &&
    [canViewSettings, canAccessAllBranches, hasMultipleAllowedBranches].some(Boolean);

  const users = useMemo(() => (data ? filterUsers(data, filters) : []), [data, filters]);
  const roleOptions = useMemo(() => {
    if (rolesQuery.data && rolesQuery.data.length > 0) {
      return buildRoleOptionsFromRoles(rolesQuery.data);
    }

    return buildRoleOptions(data ?? []);
  }, [data, rolesQuery.data]);
  const branchNameById = useMemo(
    () => new Map((branchesQuery.data ?? []).map((branch) => [branch.id, branch.name])),
    [branchesQuery.data],
  );
  const activeBranches = useMemo(
    () => (branchesQuery.data ?? []).filter((branch) => branch.status === "active"),
    [branchesQuery.data],
  );
  const staffBranchFilterOptions = useMemo(
    () =>
      activeBranches.filter((branch) => {
        return [
          canViewSettings && canAccessAllBranches,
          branchScope.isBranchAllowed(branch.id),
        ].some(Boolean);
      }),
    [activeBranches, branchScope, canAccessAllBranches, canViewSettings],
  );
  const currentStaffBranchFilter = branchScope.canAccessAllBranches
    ? allBranchesFilterValue
    : branchScope.defaultBranchId || allBranchesFilterValue;

  useEffect(() => {
    setFilters((currentFilters) => {
      if (branchScope.canAccessAllBranches) {
        if (!currentFilters.branchId) {
          return {
            ...currentFilters,
            branchId: allBranchesFilterValue,
          };
        }

        return currentFilters;
      }

      const normalizedBranchId =
        currentFilters.branchId === allBranchesFilterValue
          ? currentStaffBranchFilter
          : branchScope.normalizeBranchId(currentFilters.branchId ?? "");

      if (currentFilters.branchId === currentStaffBranchFilter) {
        return currentFilters;
      }

      return {
        ...currentFilters,
        branchId: normalizedBranchId || currentStaffBranchFilter,
      };
    });
  }, [branchScope, currentStaffBranchFilter]);

  useEffect(() => {
    if (
      (error instanceof ApiError && error.status === 401) ||
      (rolesQuery.error instanceof ApiError && rolesQuery.error.status === 401) ||
      (branchesQuery.error instanceof ApiError && branchesQuery.error.status === 401) ||
      (invitationsQuery.error instanceof ApiError && invitationsQuery.error.status === 401)
    ) {
      void logout().finally(() => {
        router.replace(ROUTES.login);
      });
    }
  }, [branchesQuery.error, error, invitationsQuery.error, logout, rolesQuery.error, router]);

  const openCreateDialog = (): void => {
    setDialogMode("create");
    setSelectedUser(null);
    setDialogOpen(true);
  };

  const openInviteDialog = (): void => {
    setInviteDialogOpen(true);
  };

  const openEditDialog = (targetUser: User): void => {
    setDialogMode("edit");
    setSelectedUser(targetUser);
    setDialogOpen(true);
  };

  const viewUserDetails = (targetUser: User): void => {
    setDialogMode("edit");
    setSelectedUser(targetUser);
    setDialogOpen(true);
  };

  const closeDialog = (): void => {
    setDialogOpen(false);
    setSelectedUser(null);
  };

  const closeInviteDialog = (): void => {
    setInviteDialogOpen(false);
  };

  const handleCreate = async (
    payload: CreateUserPayload,
    nextStatus: UserStatus,
  ): Promise<void> => {
    try {
      const createdUser = await createUserMutation.mutateAsync(payload);

      if (nextStatus !== "active") {
        await updateUserStatusMutation.mutateAsync({
          id: createdUser.id,
          payload: {
            status: nextStatus,
          },
        });
      }

      if (createdUser.branchId === null && branchScope.canAccessAllBranches) {
        setFilters((currentFilters) => ({
          ...currentFilters,
          branchId: unassignedBranchFilterValue,
        }));
      }

      toast.success("Staff user created successfully.");
      closeDialog();
    } catch (mutationError) {
      toast.error(getErrorMessage(mutationError));
    }
  };

  const handleInvite = async (payload: CreateStaffInvitationPayload): Promise<void> => {
    try {
      const invitation = await createInvitationMutation.mutateAsync(payload);
      if (invitation.token) {
        toast.success("Invitation created. Backend returned an activation token for delivery.");
      } else {
        toast.success("Invitation sent successfully.");
      }
      closeInviteDialog();
    } catch (mutationError) {
      toast.error(getErrorMessage(mutationError));
    }
  };

  const handleResendInvitation = async (invitation: StaffInvitation): Promise<void> => {
    try {
      const result = await resendInvitationMutation.mutateAsync(invitation.id);
      if (result.token) {
        toast.success("Invitation resent. Backend returned a refreshed activation token.");
      } else {
        toast.success("Invitation resent.");
      }
    } catch (mutationError) {
      toast.error(getErrorMessage(mutationError));
    }
  };

  const handleCancelInvitation = async (invitation: StaffInvitation): Promise<void> => {
    try {
      await cancelInvitationMutation.mutateAsync(invitation.id);
      toast.success("Invitation cancelled.");
    } catch (mutationError) {
      toast.error(getErrorMessage(mutationError));
    }
  };

  const handleUpdate = async (
    userId: string,
    payload: UpdateUserPayload,
    nextStatus: UserStatus,
  ): Promise<void> => {
    try {
      const branchChanged = selectedUser ? selectedUser.branchId !== payload.branchId : false;
      const realBranchAssignmentChanged =
        branchChanged && typeof payload.branchId === "string" && payload.branchId.length > 0;
      const reassignedBranchId = realBranchAssignmentChanged ? payload.branchId : null;
      const profilePayload: UpdateUserPayload = {
        fullName: payload.fullName,
        phone: payload.phone,
        roleId: payload.roleId,
        ...(branchChanged && payload.branchId === null ? { branchId: null } : {}),
        ...(payload.avatarUrl !== undefined ? { avatarUrl: payload.avatarUrl } : {}),
      };

      if (realBranchAssignmentChanged && payload.branchId) {
        await assignUserBranchMutation.mutateAsync({
          id: userId,
          payload: {
            branchId: payload.branchId,
          },
        });
      }

      await updateUserMutation.mutateAsync({
        id: userId,
        payload: profilePayload,
      });

      if (selectedUser && selectedUser.status !== nextStatus) {
        await updateUserStatusMutation.mutateAsync({
          id: userId,
          payload: {
            status: nextStatus,
          },
        });
      }

      if (payload.branchId === null && branchScope.canAccessAllBranches) {
        setFilters((currentFilters) => ({
          ...currentFilters,
          branchId: unassignedBranchFilterValue,
        }));
      }

      if (reassignedBranchId) {
        setFilters((currentFilters) => ({
          ...currentFilters,
          branchId: branchScope.canAccessAllBranches ? allBranchesFilterValue : reassignedBranchId,
        }));
      }

      if (user?.id === userId) {
        await refreshProfile();
      }

      toast.success("Staff user updated successfully.");
      closeDialog();
    } catch (mutationError) {
      toast.error(getErrorMessage(mutationError));
    }
  };

  const requestStatusChange = (targetUser: User, nextStatus: UserStatus): void => {
    setStatusDialogState({
      user: targetUser,
      nextStatus,
    });
  };

  const requestDeleteUser = (targetUser: User): void => {
    setDeleteDialogUser(targetUser);
  };

  const confirmStatusChange = async (): Promise<void> => {
    if (!statusDialogState) {
      return;
    }

    try {
      await updateUserStatusMutation.mutateAsync({
        id: statusDialogState.user.id,
        payload: {
          status: statusDialogState.nextStatus,
        },
      });

      toast.success(`User status changed to ${statusDialogState.nextStatus}.`);
      setStatusDialogState(null);
    } catch (mutationError) {
      toast.error(getErrorMessage(mutationError));
    }
  };

  const confirmDeleteUser = async (): Promise<void> => {
    if (!deleteDialogUser) {
      return;
    }

    try {
      await deleteUserMutation.mutateAsync(deleteDialogUser.id);
      toast.success(`${deleteDialogUser.fullName} deleted successfully.`);
      setDeleteDialogUser(null);
    } catch (mutationError) {
      toast.error(getErrorMessage(mutationError));
    }
  };

  if (!canViewUsers) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="space-y-3 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-cappuccino/30 text-brand-caramel">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-semibold text-brand-espresso">Access denied</h2>
            <p className="mx-auto max-w-xl text-sm leading-6 text-brand-mocha">
              You do not have the `users.view` permission required to view staff management.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isPermissionDenied = error instanceof ApiError && error.status === 403;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Staff Management"
        description="Manage staff users, roles, access, and account status."
        actions={
          canCreateUsers ? (
            <>
              <Button onClick={openInviteDialog}>
                <UserPlus className="h-4 w-4" />
                Invite User
              </Button>
              <Button onClick={openCreateDialog} variant="outline">
                Create User
              </Button>
            </>
          ) : undefined
        }
      />

      <UserFilters
        allowAllBranches={branchScope.canAccessAllBranches}
        branchOptions={staffBranchFilterOptions}
        filters={filters}
        onFiltersChange={setFilters}
        showUnassignedBranch={branchScope.canAccessAllBranches}
        showBranchFilter={canUseStaffBranchFilter}
      />

      {isLoading ? <UsersTableSkeleton /> : null}

      {!isLoading && error ? (
        isPermissionDenied ? (
          <Card>
            <CardContent className="p-8">
              <div className="space-y-3 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-cappuccino/30 text-brand-caramel">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-semibold text-brand-espresso">Permission denied</h2>
                <p className="mx-auto max-w-xl text-sm leading-6 text-brand-mocha">
                  The backend denied access to the staff users endpoint. Your current role does not
                  allow this request.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <UsersErrorState
            description={getErrorMessage(error)}
            onRetry={() => {
              void refetch();
            }}
          />
        )
      ) : null}

      {!isLoading && !error && users.length === 0 ? (
        <UsersEmptyState canCreate={canCreateUsers} onCreate={openCreateDialog} />
      ) : null}

      {!isLoading && !error && users.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <UsersTable
              branchNameById={branchNameById}
              canDelete={canDeleteUsers}
              canEdit={canEditUsers}
              currentUserId={user?.id ?? null}
              onChangeStatus={requestStatusChange}
              onDelete={requestDeleteUser}
              onEdit={openEditDialog}
              onView={viewUserDetails}
              users={users}
            />
          </CardContent>
        </Card>
      ) : null}

      <PendingInvitationsPanel
        canManage={canEditUsers}
        invitations={invitationsQuery.data ?? []}
        isLoading={invitationsQuery.isLoading}
        onCancel={(invitation) => {
          void handleCancelInvitation(invitation);
        }}
        onResend={(invitation) => {
          void handleResendInvitation(invitation);
        }}
      />

      <UserFormDialog
        branches={branchesQuery.data ?? []}
        canEditRole={canEditUsers}
        currentBranchId={branchScope.effectiveBranchId}
        mode={dialogMode}
        onClose={closeDialog}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        open={dialogOpen}
        roleOptions={roleOptions}
        user={selectedUser}
      />

      <InviteUserDialog
        branches={activeBranches}
        isSubmitting={createInvitationMutation.isPending}
        onClose={closeInviteDialog}
        onInvite={handleInvite}
        open={inviteDialogOpen}
        roleOptions={roleOptions}
      />

      <Dialog
        open={statusDialogState !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setStatusDialogState(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm status change</DialogTitle>
            <DialogDescription>
              {statusDialogState
                ? `Change ${statusDialogState.user.fullName} to ${statusDialogState.nextStatus}?`
                : "Confirm the selected status change."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setStatusDialogState(null)} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              disabled={updateUserStatusMutation.isPending}
              onClick={() => {
                void confirmStatusChange();
              }}
              type="button"
            >
              {updateUserStatusMutation.isPending ? "Updating..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteDialogUser !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setDeleteDialogUser(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete staff user</DialogTitle>
            <DialogDescription>
              {deleteDialogUser
                ? `Delete ${deleteDialogUser.fullName}? This removes the staff account from the active users list. Deactivate remains available when you only want to block access temporarily.`
                : "Confirm staff user deletion."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setDeleteDialogUser(null)} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              className="bg-red-700 text-white hover:bg-red-800"
              disabled={deleteUserMutation.isPending}
              onClick={() => {
                void confirmDeleteUser();
              }}
              type="button"
            >
              {deleteUserMutation.isPending ? "Deleting..." : "Delete user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
