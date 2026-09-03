"use client";

import { useQuery } from "@tanstack/react-query";
import { ShieldOff, ShieldPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/roles/access-denied-card";
import { PermissionMatrix } from "@/components/roles/permission-matrix";
import { RoleDetailsDrawer } from "@/components/roles/role-details-drawer";
import { RoleFormDialog } from "@/components/roles/role-form-dialog";
import { RolesCardGrid } from "@/components/roles/roles-card-grid";
import { RolesEmptyState } from "@/components/roles/roles-empty-state";
import { RolesErrorState } from "@/components/roles/roles-error-state";
import { RolesTable } from "@/components/roles/roles-table";
import { RolesTableSkeleton } from "@/components/roles/roles-table-skeleton";
import {
  defaultRolesFilters,
  type RolesFilters,
  RolesToolbar,
} from "@/components/roles/roles-toolbar";
import { FilteredState } from "@/components/shared/collection-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import {
  useCreateRole,
  useRolePermissions,
  useRoles,
  useUpdateRole,
  useUpdateRolePermissions,
} from "@/hooks/use-roles";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import { getUsers } from "@/lib/api/users";
import type { Permission, RolePermission } from "@/types/permission";
import type { CreateRolePayload, Role, RoleFormMode, UpdateRolePayload } from "@/types/role";
import type { User } from "@/types/user";

function buildRoleUserCountMap(users: User[]): Map<string, number> {
  return users.reduce<Map<string, number>>((accumulator, user) => {
    accumulator.set(user.roleId, (accumulator.get(user.roleId) ?? 0) + 1);
    return accumulator;
  }, new Map<string, number>());
}

function enrichRoles(roles: Role[], users: User[] | undefined): Role[] {
  const userCountMap = users ? buildRoleUserCountMap(users) : new Map<string, number>();

  return roles.map((role) => ({
    ...role,
    usersCount: userCountMap.get(role.id) ?? 0,
  }));
}

function getPermissionFieldError(error: unknown): string | null {
  if (!(error instanceof ApiError)) {
    return null;
  }

  const permissionErrors = error.errors?.permission_keys ?? error.errors?.permissions;
  const firstPermissionError = permissionErrors?.[0];

  return typeof firstPermissionError === "string" && firstPermissionError.length > 0
    ? firstPermissionError
    : null;
}

function getCreateRoleErrorMessage(error: unknown): string {
  return (
    getPermissionFieldError(error) ??
    `Server error: Role could not be created. ${getErrorMessage(error)}`
  );
}

export function RolesPageClient(): JSX.Element {
  const router = useRouter();
  const { logout, user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<RoleFormMode>("create");
  const [dialogRole, setDialogRole] = useState<Role | null>(null);
  // The record, not the id: the list rows already carry a full role.
  const [drawerRole, setDrawerRole] = useState<Role | null>(null);
  const [rolesFilters, setRolesFilters] = useState<RolesFilters>(defaultRolesFilters);
  const [permissionDialog, setPermissionDialog] = useState<{
    mode: "view" | "manage";
    role: Role;
  } | null>(null);
  const { data: rolesData, error, isLoading, refetch } = useRoles();
  const createRoleMutation = useCreateRole();
  const updateRoleMutation = useUpdateRole();
  const updateRolePermissionsMutation = useUpdateRolePermissions();
  const permissionsQuery = usePermissions();
  const selectedRoleId = permissionDialog?.role.id ?? null;
  const rolePermissionsQuery = useRolePermissions(selectedRoleId);
  const usersQuery = useQuery({
    queryKey: ["role-user-counts"],
    queryFn: async () => getUsers({ search: "", status: "all" }),
    enabled: user?.permissions.includes(PERMISSIONS.usersView) ?? false,
    retry: false,
  });

  const hasPermission = (permission: Permission): boolean =>
    user?.permissions.includes(permission) ?? false;
  const hasAnyPermission = (permissions: Permission[]): boolean =>
    permissions.some((permission) => hasPermission(permission));
  const canViewRoles = hasAnyPermission([PERMISSIONS.rolesView, PERMISSIONS.rolesPermissionsView]);
  const canCreateRoles = hasAnyPermission([PERMISSIONS.rolesCreate]);
  const canEditRoles = hasAnyPermission([PERMISSIONS.rolesEdit]);
  const canViewRolePermissions = hasAnyPermission([
    PERMISSIONS.rolesPermissionsView,
    PERMISSIONS.rolesView,
  ]);
  const canUpdateRolePermissions = hasAnyPermission([PERMISSIONS.rolesPermissionsUpdate]);
  const canViewUserAssignments = user?.permissions.includes(PERMISSIONS.usersView) ?? false;

  const roles = useMemo(
    () => enrichRoles(rolesData ?? [], usersQuery.data),
    [rolesData, usersQuery.data],
  );
  // The filtered view the table and cards render. The counts above stay on
  // the unfiltered list, because they describe the workspace, not the search.
  const visibleRoles = useMemo(() => {
    const query = rolesFilters.search.trim().toLowerCase();

    return roles.filter((role) => {
      const matchesQuery =
        query.length === 0 ||
        role.roleName.toLowerCase().includes(query) ||
        role.description.toLowerCase().includes(query);
      const matchesStatus = rolesFilters.status === "all" || role.status === rolesFilters.status;
      const matchesType =
        rolesFilters.type === "all" ||
        (rolesFilters.type === "system" ? role.isSystemDefault : !role.isSystemDefault);

      return matchesQuery && matchesStatus && matchesType;
    });
  }, [roles, rolesFilters]);
  const hasActiveRoleFilters =
    rolesFilters.search.trim().length > 0 ||
    rolesFilters.status !== "all" ||
    rolesFilters.type !== "all";

  const selectedRole = useMemo(() => {
    if (!permissionDialog) {
      return null;
    }

    return roles.find((role) => role.id === permissionDialog.role.id) ?? permissionDialog.role;
  }, [permissionDialog, roles]);
  const customRoleCount = useMemo(
    () => roles.filter((role) => !role.isSystemDefault).length,
    [roles],
  );
  const systemRoleCount = useMemo(
    () => roles.filter((role) => role.isSystemDefault).length,
    [roles],
  );
  const activeRoleCount = useMemo(
    () => roles.filter((role) => role.status === "active").length,
    [roles],
  );
  const permissionEndpointWarning = useMemo(() => {
    if (!(permissionsQuery.error instanceof ApiError) || permissionsQuery.error.status !== 403) {
      return null;
    }

    return "The backend denied GET /api/v1/permissions. Permission selection and matrix editing require roles view or permission-management access.";
  }, [permissionsQuery.error]);
  const permissionMatrixErrorMessage = useMemo(() => {
    if (permissionEndpointWarning) {
      return null;
    }

    if (permissionsQuery.error) {
      return getErrorMessage(permissionsQuery.error);
    }

    if (rolePermissionsQuery.error) {
      return getErrorMessage(rolePermissionsQuery.error);
    }

    return null;
  }, [permissionEndpointWarning, permissionsQuery.error, rolePermissionsQuery.error]);
  const permissionsDialogUnavailableReason = useMemo(() => {
    if (permissionEndpointWarning) {
      return permissionEndpointWarning;
    }

    if (permissionsQuery.error) {
      return getErrorMessage(permissionsQuery.error);
    }

    return null;
  }, [permissionEndpointWarning, permissionsQuery.error]);

  useEffect(() => {
    const authError = [
      error,
      permissionsQuery.error,
      rolePermissionsQuery.error,
      usersQuery.error,
    ].find((candidate) => candidate instanceof ApiError && candidate.status === 401);

    if (authError instanceof ApiError) {
      void logout().finally(() => {
        router.replace(ROUTES.login);
      });
    }
  }, [error, logout, permissionsQuery.error, rolePermissionsQuery.error, router, usersQuery.error]);

  const openCreateDialog = (): void => {
    setDialogMode("create");
    setDialogRole(null);
    setDialogOpen(true);
  };

  const openEditDialog = (role: Role): void => {
    setDialogMode("edit");
    setDialogRole(role);
    setDialogOpen(true);
  };

  const closeDialog = (): void => {
    setDialogOpen(false);
    setDialogRole(null);
  };

  const openPermissionsDialog = (role: Role, mode: "view" | "manage"): void => {
    setPermissionDialog({ role, mode });
  };

  // A dialog on top of a sheet on top of the list is one layer too many, so
  // the drawer closes before either dialog opens.
  const editFromDrawer = (role: Role): void => {
    setDrawerRole(null);
    openEditDialog(role);
  };

  const managePermissionsFromDrawer = (role: Role): void => {
    setDrawerRole(null);
    openPermissionsDialog(role, "manage");
  };

  const listHandlers = {
    canEdit: canEditRoles,
    canManagePermissions: canUpdateRolePermissions,
    canViewUserAssignments,
    onEdit: editFromDrawer,
    onManagePermissions: managePermissionsFromDrawer,
    onView: setDrawerRole,
    roles: visibleRoles,
  };

  const handleCreateRole = async (payload: CreateRolePayload): Promise<void> => {
    try {
      const createdRole = await createRoleMutation.mutateAsync(payload);
      toast.success("Role created successfully.");
      setPermissionDialog({ role: createdRole, mode: "manage" });
      closeDialog();
    } catch (mutationError) {
      toast.error(getCreateRoleErrorMessage(mutationError));
      throw mutationError;
    }
  };

  const handleUpdateRole = async (roleId: string, payload: UpdateRolePayload): Promise<void> => {
    try {
      await updateRoleMutation.mutateAsync({
        id: roleId,
        payload,
      });
      toast.success("Role updated successfully.");
      closeDialog();
    } catch (mutationError) {
      toast.error(getErrorMessage(mutationError));
      throw mutationError;
    }
  };

  const handleSaveRolePermissions = async (payload: RolePermission[]): Promise<void> => {
    if (!selectedRole) {
      return;
    }

    try {
      const updatedRole = await updateRolePermissionsMutation.mutateAsync({
        id: selectedRole.id,
        payload: {
          permissions: payload.map((permission) => ({
            permissionId: permission.permissionId,
            allowed: permission.allowed,
          })),
        },
      });
      toast.success("Role permissions updated successfully.");
      setPermissionDialog({ role: updatedRole, mode: "manage" });
    } catch (mutationError) {
      toast.error(getErrorMessage(mutationError));
    }
  };

  if (!canViewRoles) {
    return (
      <AccessDeniedCard description="You need `roles.view` or `roles.permissions.view` to view roles and permissions." />
    );
  }

  const isPermissionDenied = error instanceof ApiError && error.status === 403;

  if (isPermissionDenied) {
    return (
      <AccessDeniedCard description="The backend denied access to the roles endpoint. Your current role does not allow this request." />
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Roles & Permissions"
        description="Control what each staff role can access and perform inside the POS system."
        actions={
          canCreateRoles ? (
            <Button
              disabled={permissionsQuery.isLoading || permissionsQuery.data === undefined}
              onClick={openCreateDialog}
            >
              <ShieldPlus className="h-4 w-4" />
              Create Role
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Roles</CardDescription>
            <CardTitle className="text-3xl">{roles.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active Roles</CardDescription>
            <CardTitle className="text-3xl">{activeRoleCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>System Roles</CardDescription>
            <CardTitle className="text-3xl">{systemRoleCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Custom Roles</CardDescription>
            <CardTitle className="text-3xl">{customRoleCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {!isLoading && !error ? (
        <RolesToolbar filters={rolesFilters} onFiltersChange={setRolesFilters} />
      ) : null}

      {/* This used to key off customRoleCount, so a workspace with system roles
          and no custom ones showed "no roles yet" AND the populated table at
          the same time. It is the visible list that can be empty. */}
      {!isLoading && !error && visibleRoles.length === 0 && hasActiveRoleFilters ? (
        <FilteredState
          noun="roles"
          onClearFilters={() => setRolesFilters(defaultRolesFilters)}
          query={rolesFilters.search.trim() || undefined}
        />
      ) : null}

      {!isLoading && !error && roles.length === 0 ? (
        <RolesEmptyState canCreate={canCreateRoles} onCreate={openCreateDialog} />
      ) : null}

      {isLoading ? <RolesTableSkeleton /> : null}

      {!isLoading && error ? (
        <RolesErrorState
          description={getErrorMessage(error)}
          onRetry={() => {
            void refetch();
          }}
        />
      ) : null}

      {!isLoading && !error && visibleRoles.length > 0 ? (
        <>
          <div className="md:hidden">
            <RolesCardGrid {...listHandlers} />
          </div>
          <Card className="hidden overflow-hidden md:block">
            <CardContent className="p-0">
              <RolesTable {...listHandlers} />
            </CardContent>
          </Card>
        </>
      ) : null}

      <RoleDetailsDrawer
        canEdit={canEditRoles}
        canManagePermissions={canUpdateRolePermissions}
        canViewPermissions={canViewRolePermissions}
        canViewUserAssignments={canViewUserAssignments}
        onEdit={editFromDrawer}
        onManagePermissions={managePermissionsFromDrawer}
        onOpenChange={(open) => (!open ? setDrawerRole(null) : undefined)}
        open={drawerRole !== null}
        role={drawerRole}
      />

      <RoleFormDialog
        canManage={dialogMode === "create" ? canCreateRoles : canEditRoles}
        mode={dialogMode}
        onClose={closeDialog}
        onCreate={handleCreateRole}
        onUpdate={handleUpdateRole}
        open={dialogOpen}
        permissions={permissionsQuery.data ?? []}
        permissionsUnavailableReason={permissionsDialogUnavailableReason}
        role={dialogRole}
      />

      <Dialog
        open={permissionDialog !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setPermissionDialog(null);
          }
        }}
      >
        <DialogContent className="flex max-h-[90vh] max-w-6xl flex-col overflow-hidden p-0">
          <DialogHeader className="border-b border-brand-cappuccino px-6 pb-4 pt-6">
            <DialogTitle>
              {permissionDialog?.mode === "manage" ? "Manage permissions" : "View permissions"}
            </DialogTitle>
            <DialogDescription>
              {selectedRole
                ? `${selectedRole.roleName} access across POS modules.`
                : "Role permissions across POS modules."}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden px-6 py-5">
            <PermissionMatrix
              canManage={canUpdateRolePermissions && permissionDialog?.mode === "manage"}
              errorMessage={permissionMatrixErrorMessage}
              isLoading={permissionsQuery.isLoading || rolePermissionsQuery.isLoading}
              isSaving={updateRolePermissionsMutation.isPending}
              onSave={handleSaveRolePermissions}
              onRetry={() => {
                void permissionsQuery.refetch();
                void rolePermissionsQuery.refetch();
              }}
              permissions={permissionsQuery.data ?? []}
              role={selectedRole}
              rolePermissions={rolePermissionsQuery.data}
              saveDisabledReason={permissionEndpointWarning}
              showSave={permissionDialog?.mode === "manage"}
            />
          </div>
        </DialogContent>
      </Dialog>

      {!canViewUserAssignments ? (
        <Card>
          <CardContent className="flex items-start gap-3 p-5 text-sm leading-6 text-brand-mocha">
            <ShieldOff className="mt-0.5 h-5 w-5 shrink-0 text-brand-caramel" />
            Assigned user counts are shown only when the current account also has `users.view`,
            because the backend does not include `users_count` in the role list response.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
