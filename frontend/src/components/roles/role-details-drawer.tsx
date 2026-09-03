"use client";

import { PencilLine, ShieldEllipsis } from "lucide-react";
import type { JSX, ReactNode } from "react";
import { useState } from "react";

import { PermissionMatrix } from "@/components/roles/permission-matrix";
import { RoleStatusBadge } from "@/components/roles/role-status-badge";
import { FormTabs } from "@/components/shared/form-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { usePermissions } from "@/hooks/use-permissions";
import { useRolePermissions } from "@/hooks/use-roles";
import type { PermissionDefinition } from "@/types/permission";
import type { Role } from "@/types/role";

const ROLE_DRAWER_TABPANEL_ID = "role-drawer-tabpanel";

type RoleDrawerTabKey = "overview" | "permissions";

export function formatRoleDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Unavailable"
    : new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(parsed);
}

export function roleTypeLabel(role: Role): string {
  return role.isSystemDefault ? "System default" : "Custom role";
}

function InfoField({
  label,
  numeric = false,
  value,
}: {
  label: string;
  numeric?: boolean;
  value: ReactNode;
}): JSX.Element {
  return (
    <div className="min-w-0">
      <p className="text-meta text-foreground-muted">{label}</p>
      <p className={`mt-0.5 break-words text-cell font-medium ${numeric ? "tabular-nums" : ""}`}>
        {value}
      </p>
    </div>
  );
}

type RoleDetailsDrawerProps = {
  canManagePermissions: boolean;
  canEdit: boolean;
  canViewPermissions: boolean;
  canViewUserAssignments: boolean;
  /** Both close the drawer first, then open the host's dialog. */
  onEdit: (role: Role) => void;
  onManagePermissions: (role: Role) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  role: Role | null;
};

/**
 * A role, over the list.
 *
 * Reading a role's permissions used to mean opening a full-screen dialog from
 * the kebab; the row itself did nothing. The permissions are now a tab of the
 * record, read-only, and the dialog is kept for editing them. Tab state is in
 * memory and the tabs are buttons: there is no /roles/[id] route.
 */
export function RoleDetailsDrawer({
  canEdit,
  canManagePermissions,
  canViewPermissions,
  canViewUserAssignments,
  onEdit,
  onManagePermissions,
  onOpenChange,
  open,
  role,
}: RoleDetailsDrawerProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<RoleDrawerTabKey>("overview");
  const roleId = role?.id ?? null;
  // The role permission query only runs once the Permissions tab is shown, so
  // opening a drawer to read a description does not fetch a matrix.
  const wantsPermissions = open && canViewPermissions && activeTab === "permissions";
  const permissionsQuery = usePermissions();
  const rolePermissionsQuery = useRolePermissions(wantsPermissions ? roleId : null);

  const allPermissions: PermissionDefinition[] = permissionsQuery.data ?? [];

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl" side="right">
        {role ? (
          // Keyed by role: opening a different row resets the tab.
          <div className="grid min-w-0 gap-6" key={role.id}>
            <SheetHeader className="space-y-0 p-0">
              <SheetTitle className="text-section">{role.roleName}</SheetTitle>
              <SheetDescription className="sr-only">
                Role details and the permissions it grants.
              </SheetDescription>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <RoleStatusBadge status={role.status} />
                <Badge variant="outline">{roleTypeLabel(role)}</Badge>
              </div>
              {canEdit || canManagePermissions ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {canEdit ? (
                    <Button onClick={() => onEdit(role)} size="sm" type="button" variant="outline">
                      <PencilLine className="h-4 w-4" />
                      Edit role
                    </Button>
                  ) : null}
                  {canManagePermissions ? (
                    <Button
                      onClick={() => onManagePermissions(role)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <ShieldEllipsis className="h-4 w-4" />
                      Manage permissions
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </SheetHeader>

            <FormTabs
              active={activeTab}
              aria-label="Role sections"
              onTabChange={setActiveTab}
              panelId={ROLE_DRAWER_TABPANEL_ID}
              tabs={[
                { key: "overview", label: "Overview" },
                { key: "permissions", label: "Permissions" },
              ]}
            />

            <div className="min-w-0" id={ROLE_DRAWER_TABPANEL_ID} role="tabpanel" tabIndex={-1}>
              {activeTab === "overview" ? (
                <div className="grid gap-4">
                  <div className="rounded-lg border border-border bg-card p-4">
                    <p className="text-meta text-foreground-muted">Description</p>
                    <p className="mt-1 text-cell">
                      {role.description || "No description provided."}
                    </p>
                  </div>

                  <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
                    <InfoField label="Type" value={roleTypeLabel(role)} />
                    <InfoField label="Status" value={<RoleStatusBadge status={role.status} />} />
                    {/* The backend omits users_count unless the caller also has
                        users.view, so "Restricted" is a permission fact, not a
                        missing value. */}
                    <InfoField
                      label="Assigned users"
                      numeric={canViewUserAssignments}
                      value={
                        canViewUserAssignments ? role.usersCount : "Restricted without users.view"
                      }
                    />
                    <InfoField label="Created" numeric value={formatRoleDate(role.createdAt)} />
                    <InfoField label="Updated" numeric value={formatRoleDate(role.updatedAt)} />
                  </div>

                  {role.isSystemDefault ? (
                    <div className="rounded-lg border border-border bg-muted p-4">
                      <p className="text-cell text-foreground-muted">
                        System default roles ship with the product. Their permissions can be
                        reviewed here and adjusted from Manage permissions, but the role itself
                        cannot be removed.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {activeTab === "permissions" ? (
                canViewPermissions ? (
                  <PermissionMatrix
                    canManage={false}
                    errorMessage={
                      permissionsQuery.error || rolePermissionsQuery.error
                        ? "Permissions could not be loaded."
                        : null
                    }
                    isLoading={permissionsQuery.isLoading || rolePermissionsQuery.isLoading}
                    isSaving={false}
                    onRetry={() => {
                      void permissionsQuery.refetch();
                      void rolePermissionsQuery.refetch();
                    }}
                    onSave={() => Promise.resolve()}
                    permissions={allPermissions}
                    role={role}
                    rolePermissions={rolePermissionsQuery.data}
                    showSave={false}
                  />
                ) : (
                  <p className="text-cell text-foreground-muted">
                    You need `roles.permissions.view` to see what this role grants.
                  </p>
                )
              ) : null}
            </div>
          </div>
        ) : (
          // Radix requires a title on every open sheet, including this one.
          <SheetHeader>
            <SheetTitle className="sr-only">Role</SheetTitle>
            <SheetDescription>No role selected.</SheetDescription>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}
