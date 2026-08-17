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
};

function formatLabel(value: string): string {
  return value
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
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
    description: `Control ${formatLabel(moduleName).toLowerCase()} actions exposed by the backend permissions API.`,
  };
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
                disabled={disabled}
                id={inputId}
                onCheckedChange={(nextValue: CheckedState) => {
                  onToggle(permission.id, nextValue === true);
                }}
              />
              <div className="space-y-1">
                <p className="text-sm font-medium text-brand-espresso">
                  {getPermissionActionLabel(permission.permissionKey)}
                </p>
                <p className="text-xs font-medium text-brand-mocha/70">
                  {permission.permissionKey}
                </p>
                <p className="text-sm leading-6 text-brand-mocha">{permission.description}</p>
              </div>
            </label>
          );
        })}
      </CardContent>
    </Card>
  );
}
