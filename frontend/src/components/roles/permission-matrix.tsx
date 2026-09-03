"use client";

import { ChevronDown, Search, ShieldCheck } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";
import type {
  Permission,
  PermissionDefinition,
  PermissionModuleName,
  RolePermission,
} from "@/types/permission";
import { PERMISSION_MODULE_META } from "@/types/permission";
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

type ModuleGroup = {
  moduleName: PermissionModuleName;
  permissions: (PermissionDefinition & { actionLabel: string })[];
  title: string;
};

const permissionRequiredMessage = "Select at least one permission before saving.";

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

/** "users.activity.view" -> "Activity View". The module prefix is the heading. */
function getPermissionAction(permissionKey: Permission): string {
  const [, ...actionParts] = permissionKey.split(".");
  return actionParts.length > 0 ? actionParts.join(".") : permissionKey;
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
  const [search, setSearch] = useState("");
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
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
    const everyId = new Set<string>([
      ...Array.from(selectedPermissionIds),
      ...Array.from(initialSelection),
    ]);

    everyId.forEach((permissionId) => {
      if (selectedPermissionIds.has(permissionId) !== initialSelection.has(permissionId)) {
        changed.add(permissionId);
      }
    });

    return changed;
  }, [initialSelection, selectedPermissionIds]);

  const groups = useMemo<ModuleGroup[]>(() => {
    const byModule = new Map<PermissionModuleName, ModuleGroup>();

    permissions.forEach((permission) => {
      const existing = byModule.get(permission.moduleName);
      const entry = {
        ...permission,
        actionLabel: formatLabel(getPermissionAction(permission.permissionKey)),
      };

      if (existing) {
        existing.permissions.push(entry);
        return;
      }

      byModule.set(permission.moduleName, {
        moduleName: permission.moduleName,
        permissions: [entry],
        title: getModuleTitle(permission.moduleName),
      });
    });

    return Array.from(byModule.values())
      .map((group) => ({
        ...group,
        permissions: [...group.permissions].sort((a, b) =>
          a.actionLabel.localeCompare(b.actionLabel),
        ),
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [permissions]);

  // Searching narrows to matching permissions and shows the modules holding
  // them open, so a search never leaves you looking at collapsed rows.
  const query = search.trim().toLowerCase();
  const visibleGroups = useMemo(() => {
    if (query.length === 0) {
      return groups;
    }

    return groups
      .map((group) => ({
        ...group,
        permissions: group.permissions.filter(
          (permission) =>
            permission.actionLabel.toLowerCase().includes(query) ||
            permission.permissionKey.toLowerCase().includes(query) ||
            group.title.toLowerCase().includes(query),
        ),
      }))
      .filter((group) => group.permissions.length > 0);
  }, [groups, query]);

  const totalCount = permissions.length;
  const selectedCount = selectedPermissionIds.size;
  const hasChanges = changedPermissionIds.size > 0;
  const matrixDisabled = !showSave || !canManage || adminRole || saveDisabledReason !== null;

  const toggleOne = (permissionId: string, checked: boolean): void => {
    setSelectedPermissionIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(permissionId);
      } else {
        next.delete(permissionId);
      }
      return next;
    });
  };

  const toggleMany = (ids: string[], checked: boolean): void => {
    setSelectedPermissionIds((current) => {
      const next = new Set(current);
      ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      return next;
    });
  };

  const toggleExpanded = (moduleName: string): void => {
    setExpandedModules((current) => {
      const next = new Set(current);
      if (next.has(moduleName)) {
        next.delete(moduleName);
      } else {
        next.add(moduleName);
      }
      return next;
    });
  };

  if (!role) {
    return (
      <Card>
        <CardContent className="flex min-h-64 items-center justify-center p-8 text-center">
          <div className="grid gap-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-foreground-muted">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <p className="text-section font-medium">Select a role</p>
            <p className="max-w-md text-cell text-foreground-muted">
              Choose a role to review what it can do.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-3">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-14 w-full rounded-lg" />
      </div>
    );
  }

  if (errorMessage) {
    return (
      <Card>
        <CardContent className="grid gap-4 p-6">
          <p className="text-cell font-medium">Permissions could not be loaded.</p>
          <p className="text-cell text-foreground-muted">{errorMessage}</p>
          {onRetry ? (
            <Button className="w-fit" onClick={onRetry} type="button" variant="outline">
              Try again
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  const footerStatusMessage =
    selectedCount === 0
      ? permissionRequiredMessage
      : hasChanges
        ? `${String(changedPermissionIds.size)} unsaved ${changedPermissionIds.size === 1 ? "change" : "changes"}.`
        : "No unsaved changes.";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* One line of state, not three stacked banners. The count is the thing
          you check; everything else earns its place only when it applies. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-cell text-foreground-muted">
          <span className="font-medium tabular-nums text-foreground">{selectedCount}</span> of{" "}
          <span className="tabular-nums">{totalCount}</span> permissions granted
        </p>
        {!matrixDisabled ? (
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() =>
                toggleMany(
                  permissions.map((permission) => permission.id),
                  true,
                )
              }
              size="sm"
              type="button"
              variant="outline"
            >
              Grant all
            </Button>
            <Button
              onClick={() =>
                toggleMany(
                  permissions.map((permission) => permission.id),
                  false,
                )
              }
              size="sm"
              type="button"
              variant="outline"
            >
              Clear all
            </Button>
          </div>
        ) : null}
      </div>

      {adminRole ? (
        <p className="rounded-lg border border-border bg-muted px-4 py-3 text-cell text-foreground-muted">
          Admin always keeps every permission, so this role cannot be edited.
        </p>
      ) : null}

      {saveDisabledReason ? (
        <p className="rounded-lg border border-warning/30 bg-warning-tint px-4 py-3 text-cell">
          {saveDisabledReason}
        </p>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
        <Input
          aria-label="Search permissions"
          className="pl-9"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search a module or permission..."
          value={search}
        />
      </div>

      {/* One row per module instead of a 7-column grid of 170 checkboxes.
          Collapsed, the whole role fits on a screen; you open only the module
          you came to change. */}
      <div className="grid min-h-0 flex-1 content-start gap-2 overflow-y-auto">
        {visibleGroups.length === 0 ? (
          <p className="rounded-lg border border-border bg-card px-4 py-6 text-center text-cell text-foreground-muted">
            No permission matches “{search.trim()}”.
          </p>
        ) : null}

        {visibleGroups.map((group) => {
          const ids = group.permissions.map((permission) => permission.id);
          const grantedInModule = ids.filter((id) => selectedPermissionIds.has(id)).length;
          const changedInModule = ids.filter((id) => changedPermissionIds.has(id)).length;
          const allGranted = grantedInModule === ids.length;
          const isOpen = expandedModules.has(group.moduleName) || query.length > 0;

          return (
            <div className="rounded-lg border border-border bg-card" key={group.moduleName}>
              <div className="flex items-center gap-3 px-4 py-3">
                <Checkbox
                  aria-label={`Grant every ${group.title} permission`}
                  checked={allGranted ? true : grantedInModule > 0 ? "indeterminate" : false}
                  disabled={matrixDisabled}
                  onCheckedChange={(checked) => toggleMany(ids, checked === true)}
                />
                <button
                  aria-expanded={isOpen}
                  className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onClick={() => toggleExpanded(group.moduleName)}
                  type="button"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{group.title}</span>
                    <span className="block text-meta text-foreground-muted">
                      <span className="tabular-nums">
                        {grantedInModule} of {ids.length}
                      </span>
                      {changedInModule > 0 ? (
                        <span className="text-warning-text">
                          {" "}
                          · <span className="tabular-nums">{changedInModule}</span> changed
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-foreground-muted transition-transform duration-fast ease-out",
                      isOpen ? "rotate-180" : "",
                    )}
                  />
                </button>
              </div>

              {isOpen ? (
                <div className="grid gap-1 border-t border-border px-2 py-2 sm:grid-cols-2">
                  {group.permissions.map((permission) => {
                    const checked = selectedPermissionIds.has(permission.id);
                    const changed = changedPermissionIds.has(permission.id);

                    return (
                      <label
                        className={cn(
                          "flex items-start gap-2.5 rounded-md p-2 transition-colors duration-fast ease-out",
                          matrixDisabled ? "" : "cursor-pointer hover:bg-muted",
                          changed ? "bg-warning-tint" : "",
                        )}
                        key={permission.id}
                      >
                        <Checkbox
                          checked={checked}
                          className="mt-0.5"
                          disabled={matrixDisabled}
                          onCheckedChange={(next) => toggleOne(permission.id, next === true)}
                        />
                        <span className="min-w-0">
                          <span className="block text-cell">{permission.actionLabel}</span>
                          {/* The raw key is the thing an operator never needs
                              and an admin occasionally does, so it stays but
                              recedes. */}
                          <span className="block truncate font-mono text-meta text-foreground-muted">
                            {permission.permissionKey}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {showSave ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p
            className={cn(
              "text-cell",
              selectedCount === 0 ? "text-danger-text" : "text-foreground-muted",
            )}
          >
            {footerStatusMessage}
          </p>
          <Button
            disabled={
              !canManage ||
              !hasChanges ||
              isSaving ||
              selectedCount === 0 ||
              saveDisabledReason !== null
            }
            onClick={() => {
              const payload = permissions.map<RolePermission>((permission) => ({
                roleId: role.id,
                permissionId: permission.id,
                allowed: selectedPermissionIds.has(permission.id),
              }));

              void onSave(payload);
            }}
            type="button"
          >
            {isSaving ? "Saving..." : "Save permissions"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
