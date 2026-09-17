"use client";

import type { CheckedState } from "@radix-ui/react-checkbox";
import type { JSX } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils/cn";
import type { PermissionDefinition, PermissionModuleName } from "@/types/permission";
import { PERMISSION_MODULE_META } from "@/types/permission";

type PermissionModuleCardProps = {
  changedPermissionIds: Set<string>;
  disabled?: boolean;
  moduleName: PermissionModuleName;
  onToggle: (permissionId: string, checked: boolean) => void;
  permissions: PermissionDefinition[];
  selectedPermissionIds: Set<string>;
  /** The editor's own permissions; others cannot be granted (ISSUE-056). */
  heldPermissionKeys?: readonly string[] | undefined;
};

const ACRONYMS: Record<string, string> = { pos: "POS", vat: "VAT" };

function formatLabel(value: string): string {
  return value
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => ACRONYMS[part] ?? `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function getModuleMeta(moduleName: PermissionModuleName): {
  description: string;
  title: string;
} {
  if (moduleName in PERMISSION_MODULE_META) {
    return PERMISSION_MODULE_META[moduleName as keyof typeof PERMISSION_MODULE_META];
  }

  return {
    title: formatLabel(moduleName),
    description: `Control what this role can do in ${formatLabel(moduleName).toLowerCase()}.`,
  };
}

// Seeded descriptions were often the key re-cased ("Audit_logs View",
// "Pos Cancel_held_sale"). Those read as labels, not sentences, so they are
// rebuilt from the key; written descriptions pass through. (ISSUE-059)
function readablePermissionDescription(permission: PermissionDefinition): string {
  const description = permission.description.trim();
  if (description === "" || description.includes("_")) {
    return `${formatLabel(permission.permissionKey.split(".")[0] ?? "")}: ${getPermissionActionLabel(permission.permissionKey).toLowerCase()}`;
  }
  return description;
}

function getPermissionActionLabel(permissionKey: string): string {
  const [, ...actionParts] = permissionKey.split(".");
  const action = actionParts.length > 0 ? actionParts.join(".") : permissionKey;

  return formatLabel(action);
}

export function PermissionModuleCard({
  changedPermissionIds,
  disabled = false,
  moduleName,
  onToggle,
  permissions,
  selectedPermissionIds,
  heldPermissionKeys,
}: PermissionModuleCardProps): JSX.Element {
  const meta = getModuleMeta(moduleName);

  return (
    <Card className="border-brand-cappuccino/80 bg-brand-latte/80 shadow-sm">
      <CardHeader className="space-y-2">
        <CardTitle className="text-lg text-brand-espresso">{meta.title}</CardTitle>
        <p className="text-sm leading-6 text-brand-mocha">{meta.description}</p>
      </CardHeader>
      <Separator className="bg-brand-cappuccino/70" />
      <CardContent className="grid gap-4 pt-6">
        {permissions.map((permission) => {
          const checked = selectedPermissionIds.has(permission.id);
          const changed = changedPermissionIds.has(permission.id);
          const inputId = `${moduleName}-${permission.id}`;
          const beyondAccess =
            heldPermissionKeys !== undefined &&
            !heldPermissionKeys.includes(permission.permissionKey);

          return (
            <label
              key={permission.id}
              htmlFor={inputId}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors",
                checked
                  ? "border-brand-caramel/70 bg-brand-caramel/10"
                  : "border-brand-cappuccino/70 bg-card/70",
                changed ? "ring-2 ring-brand-caramel/40" : undefined,
                disabled ? "cursor-not-allowed opacity-70" : "hover:border-brand-mocha/60",
              )}
            >
              <Checkbox
                checked={checked}
                disabled={disabled || (beyondAccess && !checked)}
                id={inputId}
                onCheckedChange={(nextValue: CheckedState) => {
                  onToggle(permission.id, nextValue === true);
                }}
              />
              <div className="space-y-1">
                <p className="text-sm font-medium text-brand-espresso">
                  {getPermissionActionLabel(permission.permissionKey)}
                </p>
                <p className="text-xs font-medium text-brand-mocha">{permission.permissionKey}</p>
                <p className="text-sm leading-6 text-brand-mocha">
                  {readablePermissionDescription(permission)}
                  {beyondAccess ? " (beyond your access)" : ""}
                </p>
              </div>
            </label>
          );
        })}
      </CardContent>
    </Card>
  );
}
