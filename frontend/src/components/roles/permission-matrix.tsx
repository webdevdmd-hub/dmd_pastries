"use client";

import { Save, ShieldCheck } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";
import type {
  Permission,
  PermissionDefinition,
  PermissionModuleName,
  RolePermission,
} from "@/types/permission";
import { PERMISSION_MODULE_META, PERMISSION_MODULES } from "@/types/permission";
import type { Role } from "@/types/role";

type PermissionMatrixProps = {
  canManage: boolean;
  errorMessage?: string | null;
  isLoading: boolean;
  isSaving: boolean;
  onSave: (payload: RolePermission[]) => Promise<void>;
  onRetry?: () => void;
  permissions: PermissionDefinition[];
  role: Role | null;
  rolePermissions: RolePermission[] | undefined;
  saveDisabledReason?: string | null;
  showSave?: boolean;
};

type MatrixColumn = "view" | "create" | "edit" | "delete" | "status" | "manage" | "advanced";

type MatrixCellPermission = PermissionDefinition & {
  actionLabel: string;
  column: MatrixColumn;
};

type PermissionModuleGroup = {
  moduleName: PermissionModuleName;
  permissions: MatrixCellPermission[];
};

const matrixColumns: {
  column: Exclude<MatrixColumn, "advanced">;
  label: string;
}[] = [
  { column: "view", label: "View" },
  { column: "create", label: "Create" },
  { column: "edit", label: "Edit" },
  { column: "delete", label: "Delete" },
  { column: "status", label: "Status" },
  { column: "manage", label: "Manage" },
];
const permissionRequiredMessage = "Please select at least one permission.";

function buildInitialSelection(rolePermissions: RolePermission[] | undefined): Set<string> {
  return new Set(
    (rolePermissions ?? [])
      .filter((permission) => permission.allowed)
      .map((permission) => permission.permissionId),
  );
}

function isAdminRole(role: Role | null): boolean {
  return role?.roleName.trim().toLowerCase() === "admin";
}

function formatLabel(value: string): string {
  return value
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function getModuleTitle(moduleName: PermissionModuleName): string {
  if (moduleName in PERMISSION_MODULE_META) {
    return PERMISSION_MODULE_META[moduleName as keyof typeof PERMISSION_MODULE_META].title;
  }

  return formatLabel(moduleName);
}

function getPermissionAction(permissionKey: Permission): string {
  const [, ...actionParts] = permissionKey.split(".");
  return actionParts.length > 0 ? actionParts.join(".") : permissionKey;
}

function getPermissionColumn(permissionKey: Permission): MatrixColumn {
  const action = getPermissionAction(permissionKey);

  if (action === "view" || action.endsWith(".view") || action === "lookup") {
    return "view";
  }

  if (
    action === "create" ||
    action.includes(".create") ||
    action === "add" ||
    action === "invite" ||
    action === "quick_create" ||
    action === "opening_stock" ||
    action === "manual_create"
  ) {
    return "create";
  }

  if (
    action === "edit" ||
    action.includes(".edit") ||
    action.endsWith(".update") ||
    action === "adjust"
  ) {
    return "edit";
  }

  if (
    action === "delete" ||
    action.includes(".delete") ||
    action === "void" ||
    action === "reverse" ||
    action === "cancel_held_sale"
  ) {
    return "delete";
  }

  if (action === "status.update" || action.includes(".status.update")) {
    return "status";
  }

  if (
    action === "manage" ||
    action.endsWith(".manage") ||
    action === "sell" ||
    action === "checkout" ||
    action === "reconcile"
  ) {
    return "manage";
  }

  return "advanced";
}

function compareModuleNames(left: string, right: string): number {
  const leftIndex = PERMISSION_MODULES.findIndex((moduleName) => moduleName === left);
  const rightIndex = PERMISSION_MODULES.findIndex((moduleName) => moduleName === right);

  if (leftIndex !== -1 && rightIndex !== -1) {
    return leftIndex - rightIndex;
  }

  if (leftIndex !== -1) {
    return -1;
  }

  if (rightIndex !== -1) {
    return 1;
  }

  return left.localeCompare(right);
}

function togglePermission(
  current: Set<string>,
  permissionId: string,
  checked: boolean,
): Set<string> {
  const next = new Set(current);

  if (checked) {
    next.add(permissionId);
  } else {
    next.delete(permissionId);
  }

  return next;
}

function toggleManyPermissions(
  current: Set<string>,
  permissions: PermissionDefinition[],
  checked: boolean,
): Set<string> {
  const next = new Set(current);

  permissions.forEach((permission) => {
    if (checked) {
      next.add(permission.id);
    } else {
      next.delete(permission.id);
    }
  });

  return next;
}

export function PermissionMatrix({
  canManage,
  errorMessage = null,
  isLoading,
  isSaving,
  onSave,
  onRetry,
  permissions,
  role,
  rolePermissions,
  saveDisabledReason = null,
  showSave = true,
}: PermissionMatrixProps): JSX.Element {
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<Set<string>>(new Set());
  const adminRole = isAdminRole(role);

  useEffect(() => {
    if (adminRole) {
      setSelectedPermissionIds(new Set(permissions.map((permission) => permission.id)));
      return;
    }

    setSelectedPermissionIds(buildInitialSelection(rolePermissions));
  }, [adminRole, permissions, rolePermissions]);

  const initialSelection = useMemo(() => {
    if (adminRole) {
      return new Set(permissions.map((permission) => permission.id));
    }

    return buildInitialSelection(rolePermissions);
  }, [adminRole, permissions, rolePermissions]);
  const changedPermissionIds = useMemo(() => {
    const changed = new Set<string>();
    const allPermissionIds = new Set<string>([
      ...Array.from(selectedPermissionIds),
      ...Array.from(initialSelection),
    ]);

    allPermissionIds.forEach((permissionId) => {
      if (selectedPermissionIds.has(permissionId) !== initialSelection.has(permissionId)) {
        changed.add(permissionId);
      }
    });

    return changed;
  }, [initialSelection, selectedPermissionIds]);

  const groupedPermissions = useMemo<PermissionModuleGroup[]>(() => {
    const moduleNames = Array.from(
      new Set(permissions.map((permission) => permission.moduleName)),
    ).sort(compareModuleNames);

    return moduleNames.map((moduleName) => ({
      moduleName,
      permissions: permissions
        .filter((permission) => permission.moduleName === moduleName)
        .map((permission) => ({
          ...permission,
          actionLabel: formatLabel(getPermissionAction(permission.permissionKey)),
          column: getPermissionColumn(permission.permissionKey),
        })),
    }));
  }, [permissions]);

  const hasChanges = changedPermissionIds.size > 0;
  const hasSelectedPermissions = selectedPermissionIds.size > 0;
  const saveDisabled =
    !canManage ||
    !role ||
    !hasChanges ||
    isSaving ||
    !hasSelectedPermissions ||
    saveDisabledReason !== null;

  if (!role) {
    return (
      <Card>
        <CardContent className="flex min-h-[320px] items-center justify-center p-8 text-center">
          <div className="space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-cappuccino/30 text-brand-caramel">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-semibold text-brand-espresso">Select a role</h2>
            <p className="max-w-lg text-sm leading-6 text-brand-mocha">
              Choose a role from the table to inspect and manage its permission matrix.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="space-y-3">
          <Skeleton className="h-7 w-48 rounded-full" />
          <Skeleton className="h-4 w-72 rounded-full" />
        </CardHeader>
        <CardContent className="grid gap-4">
          <Skeleton className="h-36 w-full rounded-[1.5rem]" />
          <Skeleton className="h-36 w-full rounded-[1.5rem]" />
          <Skeleton className="h-36 w-full rounded-[1.5rem]" />
        </CardContent>
      </Card>
    );
  }

  if (errorMessage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-brand-espresso">Permission matrix</CardTitle>
          <CardDescription>Unable to load the selected role permissions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-brand-cappuccino bg-brand-latte/60 p-4 text-sm leading-6 text-brand-mocha">
            {errorMessage}
          </div>
          {onRetry ? (
            <Button onClick={onRetry} type="button" variant="outline">
              Retry permission request
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  const matrixDisabled = !showSave || !canManage || adminRole || saveDisabledReason !== null;
  const footerStatusMessage = !hasSelectedPermissions
    ? permissionRequiredMessage
    : hasChanges
      ? "Unsaved permission changes are ready to save."
      : "No unsaved changes.";

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-2xl text-brand-espresso">
              Permission matrix for {role.roleName}
            </CardTitle>
            {/* Read-only viewers cannot toggle anything, and telling them to
                was the copy describing a control they do not have. */}
            <CardDescription>
              {canManage
                ? "Toggle module permissions and save them back through the backend role update flow."
                : `What  can do across POS modules. Open Manage permissions to change it.`}
            </CardDescription>
          </div>
          <div className="rounded-2xl border border-brand-cappuccino bg-brand-latte/60 px-4 py-3 text-sm text-brand-mocha">
            <span className="font-semibold text-brand-espresso">{selectedPermissionIds.size}</span>{" "}
            of {permissions.length} permissions selected
          </div>
        </div>
        {adminRole ? (
          <div className="rounded-2xl border border-brand-cappuccino bg-brand-cappuccino/25 p-4 text-sm leading-6 text-brand-mocha">
            Admin is protected by the backend and must always keep every available permission.
            Permission removal is disabled for this role.
          </div>
        ) : role.isSystemDefault ? (
          <div className="rounded-2xl border border-brand-cappuccino bg-brand-cappuccino/25 p-4 text-sm leading-6 text-brand-mocha">
            This is a predefined role. Its name is locked, but its permissions can be adjusted.
          </div>
        ) : null}
        {!hasSelectedPermissions ? (
          <div className="rounded-2xl border border-warning/20 bg-warning-tint p-4 text-sm leading-6 text-warning-text">
            {permissionRequiredMessage}
          </div>
        ) : null}
        {saveDisabledReason ? (
          <div className="rounded-2xl border border-warning/20 bg-warning-tint p-4 text-sm leading-6 text-warning-text">
            {saveDisabledReason}
          </div>
        ) : null}
        {hasChanges ? (
          <div className="rounded-2xl border border-brand-caramel/40 bg-brand-caramel/10 p-4 text-sm leading-6 text-brand-mocha">
            You have unsaved permission changes for this role.
          </div>
        ) : (
          <div className="rounded-2xl border border-brand-cappuccino bg-brand-latte/60 p-4 text-sm leading-6 text-brand-mocha">
            No unsaved permission changes.
          </div>
        )}
      </CardHeader>
      <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        <div className="overflow-hidden rounded-[1.5rem] border border-brand-cappuccino bg-card/80">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-brand-cappuccino bg-brand-latte/80 text-brand-espresso">
                  <th className="w-[260px] px-4 py-4 font-semibold">Module</th>
                  {matrixColumns.map((column) => (
                    <th
                      className="min-w-[120px] border-l border-brand-cappuccino/70 px-4 py-4 font-semibold"
                      key={column.column}
                    >
                      {column.label}
                    </th>
                  ))}
                  <th className="min-w-[260px] border-l border-brand-cappuccino/70 px-4 py-4 font-semibold">
                    Advanced
                  </th>
                </tr>
              </thead>
              <tbody>
                {groupedPermissions.map((group) => {
                  const selectedCount = group.permissions.filter((permission) =>
                    selectedPermissionIds.has(permission.id),
                  ).length;
                  const allSelected = selectedCount === group.permissions.length;
                  const someSelected = selectedCount > 0 && !allSelected;

                  return (
                    <tr
                      className="border-b border-brand-cappuccino/70 last:border-b-0"
                      key={group.moduleName}
                    >
                      <td className="align-top px-4 py-4">
                        <label className="flex cursor-pointer items-start gap-3">
                          <Checkbox
                            checked={allSelected ? true : someSelected ? "indeterminate" : false}
                            disabled={matrixDisabled}
                            onCheckedChange={(checked) => {
                              setSelectedPermissionIds((current) =>
                                toggleManyPermissions(current, group.permissions, checked === true),
                              );
                            }}
                          />
                          <span className="space-y-1">
                            <span className="block font-semibold text-brand-espresso">
                              {getModuleTitle(group.moduleName)}
                            </span>
                            <span className="block text-xs font-medium text-brand-mocha">
                              {selectedCount}/{group.permissions.length} selected
                            </span>
                          </span>
                        </label>
                      </td>
                      {matrixColumns.map((column) => {
                        const cellPermissions = group.permissions.filter(
                          (permission) => permission.column === column.column,
                        );

                        return (
                          <td
                            className="border-l border-brand-cappuccino/70 align-top px-4 py-4"
                            key={column.column}
                          >
                            <div className="grid gap-2">
                              {cellPermissions.length === 0 ? (
                                <span className="text-foreground-muted">-</span>
                              ) : (
                                cellPermissions.map((permission) => {
                                  const checked = selectedPermissionIds.has(permission.id);
                                  const changed = changedPermissionIds.has(permission.id);

                                  return (
                                    <label
                                      className={cn(
                                        "flex cursor-pointer items-start gap-2 rounded-xl p-2 transition-colors",
                                        checked ? "bg-brand-caramel/10" : "bg-transparent",
                                        changed ? "ring-1 ring-brand-caramel/50" : undefined,
                                        matrixDisabled
                                          ? "cursor-not-allowed opacity-70"
                                          : "hover:bg-brand-latte",
                                      )}
                                      key={permission.id}
                                      title={permission.permissionKey}
                                    >
                                      <Checkbox
                                        checked={checked}
                                        disabled={matrixDisabled}
                                        onCheckedChange={(nextValue) => {
                                          setSelectedPermissionIds((current) =>
                                            togglePermission(
                                              current,
                                              permission.id,
                                              nextValue === true,
                                            ),
                                          );
                                        }}
                                      />
                                      <span className="space-y-0.5">
                                        <span className="block text-xs font-semibold text-brand-espresso">
                                          {permission.actionLabel}
                                        </span>
                                        <span className="block font-mono text-meta leading-4 text-foreground-muted">
                                          {permission.permissionKey}
                                        </span>
                                      </span>
                                    </label>
                                  );
                                })
                              )}
                            </div>
                          </td>
                        );
                      })}
                      <td className="border-l border-brand-cappuccino/70 align-top px-4 py-4">
                        <div className="grid gap-2">
                          {group.permissions
                            .filter((permission) => permission.column === "advanced")
                            .map((permission) => {
                              const checked = selectedPermissionIds.has(permission.id);
                              const changed = changedPermissionIds.has(permission.id);

                              return (
                                <label
                                  className={cn(
                                    "flex cursor-pointer items-start gap-2 rounded-xl border p-2 transition-colors",
                                    checked
                                      ? "border-brand-caramel/60 bg-brand-caramel/10"
                                      : "border-brand-cappuccino/70 bg-brand-latte/50",
                                    changed ? "ring-1 ring-brand-caramel/50" : undefined,
                                    matrixDisabled
                                      ? "cursor-not-allowed opacity-70"
                                      : "hover:border-brand-mocha/60",
                                  )}
                                  key={permission.id}
                                  title={permission.description}
                                >
                                  <Checkbox
                                    checked={checked}
                                    disabled={matrixDisabled}
                                    onCheckedChange={(nextValue) => {
                                      setSelectedPermissionIds((current) =>
                                        togglePermission(
                                          current,
                                          permission.id,
                                          nextValue === true,
                                        ),
                                      );
                                    }}
                                  />
                                  <span className="space-y-0.5">
                                    <span className="block text-xs font-semibold text-brand-espresso">
                                      {permission.actionLabel}
                                    </span>
                                    <span className="block font-mono text-meta leading-4 text-foreground-muted">
                                      {permission.permissionKey}
                                    </span>
                                  </span>
                                </label>
                              );
                            })}
                          {group.permissions.every(
                            (permission) => permission.column !== "advanced",
                          ) ? (
                            <span className="text-foreground-muted">-</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        {!canManage && showSave ? (
          <div className="rounded-2xl border border-brand-cappuccino bg-brand-latte/60 p-4 text-sm leading-6 text-brand-mocha">
            Your role can view this matrix but cannot save changes because
            `roles.permissions.update` is missing.
          </div>
        ) : null}
      </CardContent>
      {showSave ? (
        <div className="flex items-center justify-between gap-3 border-t border-brand-cappuccino bg-card/95 px-6 py-4 backdrop-blur">
          <div className="text-sm text-brand-mocha">{footerStatusMessage}</div>
          <Button
            disabled={saveDisabled}
            onClick={() => {
              const payload = permissions.map<RolePermission>((permission) => ({
                roleId: role.id,
                permissionId: permission.id,
                allowed: selectedPermissionIds.has(permission.id),
              }));

              void onSave(payload);
            }}
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save permissions"}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
