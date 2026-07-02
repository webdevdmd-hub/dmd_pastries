"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { type FieldErrors, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getErrorMessage } from "@/lib/api/client";
import {
  type CreateRoleSchema,
  createRoleSchema,
  type UpdateRoleSchema,
  updateRoleSchema,
} from "@/lib/validators/role.schema";
import type { PermissionDefinition } from "@/types/permission";
import type {
  CreateRolePayload,
  Role,
  RoleFormMode,
  RoleStatus,
  UpdateRolePayload,
} from "@/types/role";

import { PermissionModuleCard } from "./permission-module-card";

type RoleFormDialogProps = {
  canManage: boolean;
  mode: RoleFormMode;
  onClose: () => void;
  onCreate: (payload: CreateRolePayload) => Promise<void>;
  onUpdate: (roleId: string, payload: UpdateRolePayload) => Promise<void>;
  open: boolean;
  permissions: PermissionDefinition[];
  permissionsUnavailableReason?: string | null;
  role: Role | null;
};

const roleStatusOptions: RoleStatus[] = ["active", "inactive"];
const validationToastMessage = "Validation error: Please fill all required fields.";

function createRoleValidationMessage(errors: FieldErrors<CreateRoleSchema>): string {
  const firstMessage =
    errors.roleName?.message ?? errors.permissions?.message ?? errors.description?.message;

  return typeof firstMessage === "string"
    ? `Validation error: ${firstMessage}`
    : validationToastMessage;
}

function createRoleServerErrorMessage(error: unknown): string {
  return `Server error: Role could not be created. ${getErrorMessage(error)}`;
}

function groupPermissions(
  permissions: PermissionDefinition[],
): Record<string, PermissionDefinition[]> {
  return permissions.reduce<Record<string, PermissionDefinition[]>>((accumulator, permission) => {
    const modulePermissions = accumulator[permission.moduleName] ?? [];

    modulePermissions.push(permission);
    accumulator[permission.moduleName] = modulePermissions;
    return accumulator;
  }, {});
}

export function RoleFormDialog({
  canManage,
  mode,
  onClose,
  onCreate,
  onUpdate,
  open,
  permissions,
  permissionsUnavailableReason = null,
  role,
}: RoleFormDialogProps): JSX.Element {
  const [createSubmitMessage, setCreateSubmitMessage] = useState<string | null>(null);
  const createForm = useForm<CreateRoleSchema>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: {
      roleName: "",
      description: "",
      permissions: [],
    },
  });
  const updateForm = useForm<UpdateRoleSchema>({
    resolver: zodResolver(updateRoleSchema),
    defaultValues: {
      roleName: "",
      description: "",
      status: "active",
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    if (mode === "create") {
      setCreateSubmitMessage(null);
      createForm.reset({
        roleName: "",
        description: "",
        permissions: [],
      });
      return;
    }

    if (role) {
      setCreateSubmitMessage(null);
      updateForm.reset({
        roleName: role.roleName,
        description: role.description,
        status: role.status,
      });
    }
  }, [createForm, mode, open, role, updateForm]);

  const groupedPermissions = useMemo(() => groupPermissions(permissions), [permissions]);
  const createSelectedPermissions = createForm.watch("permissions");
  const selectedPermissionIds = new Set(createSelectedPermissions);
  const createDisabled =
    !canManage || permissions.length === 0 || permissionsUnavailableReason !== null;
  const createBlockingMessage = !canManage
    ? "You do not have permission to create roles."
    : permissionsUnavailableReason ??
      (permissions.length === 0
        ? "Permission data is not available yet. Role creation requires at least one permission."
        : null);
  const editingDefaultRole = mode === "edit" && role?.isSystemDefault === true;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create role" : "Edit role"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Define a new staff role and choose its initial permission footprint."
              : "Update the selected role metadata. Permission changes are handled in the matrix panel."}
          </DialogDescription>
        </DialogHeader>

        {mode === "create" ? (
          <Form {...createForm}>
            <form
              className="space-y-6"
              onSubmit={(event) => {
                void createForm.handleSubmit(
                  async (values) => {
                    setCreateSubmitMessage(null);

                    try {
                      await onCreate({
                        roleName: values.roleName,
                        description: values.description ?? "",
                        permissions: values.permissions,
                      });
                    } catch (error) {
                      setCreateSubmitMessage(createRoleServerErrorMessage(error));
                    }
                  },
                  (errors) => {
                    setCreateSubmitMessage(createRoleValidationMessage(errors));
                    toast.error(validationToastMessage);
                  },
                )(event);
              }}
            >
              {createBlockingMessage || createSubmitMessage ? (
                <Alert
                  className={
                    createSubmitMessage
                      ? "border-red-200 bg-red-50 text-red-950"
                      : "border-amber-200 bg-amber-50 text-amber-950"
                  }
                  variant={createSubmitMessage ? "destructive" : "default"}
                >
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>
                    {createSubmitMessage ? "Role creation failed" : "Role creation unavailable"}
                  </AlertTitle>
                  <AlertDescription>
                    {createSubmitMessage ?? createBlockingMessage}
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="grid gap-5 md:grid-cols-2">
                <FormField
                  control={createForm.control}
                  name="roleName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Cashier Supervisor"
                          {...field}
                          onChange={(event) => {
                            setCreateSubmitMessage(null);
                            field.onChange(event);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <textarea
                          className="min-h-24 w-full rounded-2xl border border-brand-cappuccino bg-brand-latte px-4 py-3 text-sm text-brand-espresso outline-none ring-offset-background placeholder:text-brand-mocha/60 focus-visible:ring-2 focus-visible:ring-brand-caramel"
                          placeholder="Handles counter operations, end-of-shift reconciliation, and staff oversight."
                          {...field}
                          onChange={(event) => {
                            setCreateSubmitMessage(null);
                            field.onChange(event);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={createForm.control}
                name="permissions"
                render={() => (
                  <FormItem>
                    <FormLabel>Initial permissions</FormLabel>
                    <FormDescription>
                      The current backend requires at least one permission when creating a role.
                    </FormDescription>
                    <div className="grid gap-4 lg:grid-cols-2">
                      {Object.entries(groupedPermissions).map(([moduleName, modulePermissions]) => (
                        <PermissionModuleCard
                          key={moduleName}
                          changedPermissionIds={new Set()}
                          disabled={createDisabled}
                          moduleName={moduleName}
                          onToggle={(permissionId, checked) => {
                            setCreateSubmitMessage(null);
                            const currentValues = createForm.getValues("permissions");

                            if (checked) {
                              if (!currentValues.includes(permissionId)) {
                                createForm.setValue(
                                  "permissions",
                                  [...currentValues, permissionId],
                                  {
                                    shouldValidate: true,
                                  },
                                );
                              }
                              return;
                            }

                            createForm.setValue(
                              "permissions",
                              currentValues.filter((currentValue) => currentValue !== permissionId),
                              {
                                shouldValidate: true,
                              },
                            );
                          }}
                          permissions={modulePermissions}
                          selectedPermissionIds={selectedPermissionIds}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button onClick={onClose} type="button" variant="outline">
                  Cancel
                </Button>
                <Button
                  disabled={createForm.formState.isSubmitting || createDisabled}
                  type="submit"
                >
                  {createForm.formState.isSubmitting ? "Creating..." : "Create role"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          <Form {...updateForm}>
            <form
              className="space-y-6"
              onSubmit={(event) => {
                void updateForm.handleSubmit(async (values) => {
                  if (!role) {
                    return;
                  }

                  await onUpdate(role.id, {
                    roleName: values.roleName,
                    description: values.description ?? "",
                    status: values.status,
                  });
                })(event);
              }}
            >
              {role?.isSystemDefault ? (
                <div className="rounded-2xl border border-amber-700/20 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                      Predefined role names are protected by the backend. You can update the
                      description here and manage permissions from the permission matrix.
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-5 md:grid-cols-2">
                <FormField
                  control={updateForm.control}
                  name="roleName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role name</FormLabel>
                      <FormControl>
                        <Input readOnly={editingDefaultRole} {...field} />
                      </FormControl>
                      {editingDefaultRole ? (
                        <FormDescription>Predefined role names cannot be changed.</FormDescription>
                      ) : null}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={updateForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select disabled value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {roleStatusOptions.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Role status is not currently exposed as a persisted backend field, so it is
                        shown as read-only.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={updateForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <textarea
                        className="min-h-24 w-full rounded-2xl border border-brand-cappuccino bg-brand-latte px-4 py-3 text-sm text-brand-espresso outline-none ring-offset-background placeholder:text-brand-mocha/60 focus-visible:ring-2 focus-visible:ring-brand-caramel"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button onClick={onClose} type="button" variant="outline">
                  Close
                </Button>
                <Button disabled={updateForm.formState.isSubmitting || !canManage} type="submit">
                  {updateForm.formState.isSubmitting ? "Saving..." : "Save role"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
