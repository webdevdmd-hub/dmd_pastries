"use client";

import { Pencil, Trash2 } from "lucide-react";
import type { JSX, ReactNode } from "react";
import { useState } from "react";

import { FormTabs } from "@/components/shared/form-tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { UserStatusBadge } from "@/components/users/user-status-badge";
import type { User } from "@/types/user";

const USER_DRAWER_TABPANEL_ID = "user-drawer-tabpanel";

type UserDrawerTabKey = "profile" | "access" | "activity";

export function userInitials(fullName: string): string {
  return fullName
    .split(" ")
    .map((segment) => segment[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function formatUserDate(value: string | null): string {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown"
    : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatUserRelativeDate(value: string | null): string {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const differenceInMs = date.getTime() - Date.now();
  const days = Math.round(differenceInMs / (1000 * 60 * 60 * 24));

  if (Math.abs(days) >= 1) {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(days, "day");
  }

  const hours = Math.round(differenceInMs / (1000 * 60 * 60));

  if (Math.abs(hours) >= 1) {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(hours, "hour");
  }

  const minutes = Math.round(differenceInMs / (1000 * 60));

  if (Math.abs(minutes) >= 1) {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(minutes, "minute");
  }

  return "Just now";
}

function InfoField({
  label,
  mono = false,
  numeric = false,
  value,
}: {
  label: string;
  mono?: boolean;
  numeric?: boolean;
  value: ReactNode;
}): JSX.Element {
  return (
    <div className="min-w-0">
      <p className="text-meta text-foreground-muted">{label}</p>
      <div
        className={[
          "mt-0.5 break-words text-cell font-medium",
          mono ? "font-mono" : "",
          numeric ? "tabular-nums" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {value}
      </div>
    </div>
  );
}

type UserDetailsDrawerProps = {
  branchNameById: ReadonlyMap<string, string>;
  canDelete: boolean;
  canEdit: boolean;
  currentUserId: string | null;
  /** Both close the drawer first, then open the host's dialog. */
  onDelete: (user: User) => void;
  onEdit: (user: User) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  user: User | null;
};

/**
 * A staff user, over the list.
 *
 * There was no read-only view of a user at all: the kebab's "View details"
 * and "Edit user" called the same function and both opened the edit form, so
 * looking up someone's role or last login meant opening an editor over their
 * record. Tab state is in memory and the tabs are buttons: there is no
 * /users/[id] route, so there is no URL to hand out for a tab.
 */
export function UserDetailsDrawer({
  branchNameById,
  canDelete,
  canEdit,
  currentUserId,
  onDelete,
  onEdit,
  onOpenChange,
  open,
  user,
}: UserDetailsDrawerProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<UserDrawerTabKey>("profile");
  const isCurrentUser = user !== null && currentUserId === user.id;

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl" side="right">
        {user ? (
          // Keyed by user: opening a different row resets the tab.
          <div className="grid min-w-0 gap-6" key={user.id}>
            <SheetHeader className="space-y-0 p-0">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 shrink-0">
                  <AvatarFallback>{userInitials(user.fullName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <SheetTitle className="truncate text-section">{user.fullName}</SheetTitle>
                  <SheetDescription className="sr-only">
                    Staff profile, access and account activity.
                  </SheetDescription>
                  <p className="truncate text-meta text-foreground-muted">{user.roleName}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <UserStatusBadge status={user.status} />
                {isCurrentUser ? <Badge variant="outline">This is you</Badge> : null}
              </div>
              {canEdit || (canDelete && !isCurrentUser) ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {canEdit ? (
                    <Button onClick={() => onEdit(user)} size="sm" type="button" variant="outline">
                      <Pencil className="h-4 w-4" />
                      Edit user
                    </Button>
                  ) : null}
                  {/* Deleting yourself is the one action nobody should be one
                      click from, so it is not offered on your own record. */}
                  {canDelete && !isCurrentUser ? (
                    <Button
                      className="text-danger-text"
                      onClick={() => onDelete(user)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </SheetHeader>

            <FormTabs
              active={activeTab}
              aria-label="Staff user sections"
              onTabChange={setActiveTab}
              panelId={USER_DRAWER_TABPANEL_ID}
              tabs={[
                { key: "profile", label: "Profile" },
                { key: "access", label: "Access" },
                { key: "activity", label: "Activity" },
              ]}
            />

            <div className="min-w-0" id={USER_DRAWER_TABPANEL_ID} role="tabpanel" tabIndex={-1}>
              {activeTab === "profile" ? (
                <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
                  <InfoField label="Full name" value={user.fullName} />
                  <InfoField label="Email" value={user.email} />
                  <InfoField label="Phone" value={user.phone || "Not recorded"} />
                  <InfoField
                    label="Email verified"
                    value={user.emailVerified ? "Verified" : "Pending verification"}
                  />
                </div>
              ) : null}

              {activeTab === "access" ? (
                <div className="grid gap-4">
                  <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
                    <InfoField label="Role" value={user.roleName} />
                    <InfoField label="Status" value={<UserStatusBadge status={user.status} />} />
                    <InfoField
                      label="Assigned branch"
                      value={
                        user.branchId
                          ? (branchNameById.get(user.branchId) ?? "Assigned branch")
                          : "No branch assigned"
                      }
                    />
                  </div>

                  {/* An unassigned branch is why the row is tinted in the list;
                      saying what to do about it belongs here, not in a badge. */}
                  {user.branchId === null ? (
                    <div className="rounded-lg border border-warning/30 bg-warning-tint p-4">
                      <p className="text-cell font-medium">Needs branch setup</p>
                      <p className="mt-1 text-cell text-foreground-muted">
                        This user has no branch, so branch-scoped screens will show them nothing.
                        Assign one from Edit user.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {activeTab === "activity" ? (
                <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
                  <InfoField
                    label="Last login"
                    numeric
                    value={formatUserRelativeDate(user.lastLoginAt)}
                  />
                  <InfoField label="Created" numeric value={formatUserDate(user.createdAt)} />
                  <InfoField label="Updated" numeric value={formatUserDate(user.updatedAt)} />
                  <InfoField label="User ID" mono value={user.id} />
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          // Radix requires a title on every open sheet, including this one.
          <SheetHeader>
            <SheetTitle className="sr-only">Staff user</SheetTitle>
            <SheetDescription>No user selected.</SheetDescription>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}
