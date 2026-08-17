"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { JSX } from "react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

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
import {
  type CreateUserSchema,
  createUserSchema,
  type UpdateUserSchema,
  updateUserSchema,
} from "@/lib/validators/user.schema";
import type { Branch } from "@/types/branch";
import type {
  CreateUserPayload,
  UpdateUserPayload,
  User,
  UserFormMode,
  UserRoleOption,
  UserStatus,
} from "@/types/user";

type UserFormDialogProps = {
  branchLoadError: string | null;
  branches: Branch[];
  branchesLoading: boolean;
  canEditRole: boolean;
  createError: string | null;
  currentBranchId: string | null;
  currentUserId: string | null;
  mode: UserFormMode;
  onClose: () => void;
  onCreate: (payload: CreateUserPayload) => Promise<void>;
  onUpdate: (userId: string, payload: UpdateUserPayload, nextStatus: UserStatus) => Promise<void>;
  open: boolean;
  roleLoadError: string | null;
  roleOptions: UserRoleOption[];
  rolesLoading: boolean;
  user: User | null;
};

const statusOptions = ["active", "inactive", "suspended", "invited"] as const;
const unassignedBranchValue = "__unassigned__";

function getBranchSelectValue(branchId: string | null): string {
  return branchId ?? unassignedBranchValue;
}

function getPayloadBranchId(branchId: string): string | null {
  return branchId === "" || branchId === unassignedBranchValue ? null : branchId;
}

function hasBranchOption(branches: Branch[], branchId: string): boolean {
  return branches.some((branch) => branch.id === branchId);
}

function hasNonEmptySelectValue(value: string): boolean {
  return value.trim().length > 0;
}

function isBranchOptionalRoleName(roleName: string): boolean {
  const normalizedRoleName = roleName.trim().toLowerCase();

  return normalizedRoleName.includes("admin") || normalizedRoleName.includes("owner");
}

function canRoleUseUnassignedBranch(roleOptions: UserRoleOption[], roleId: string): boolean {
  const role = roleOptions.find((roleOption) => roleOption.id === roleId);

  return role ? isBranchOptionalRoleName(role.name) : false;
}

export function UserFormDialog({
  branchLoadError,
  branches,
  branchesLoading,
  canEditRole,
  createError,
  currentBranchId,
  currentUserId,
  mode,
  onClose,
  onCreate,
  onUpdate,
  open,
  roleLoadError,
  roleOptions,
  rolesLoading,
  user,
}: UserFormDialogProps): JSX.Element {
  const assignableBranches = branches.filter(
    (branch) => branch.status === "active" || branch.id === user?.branchId,
  );
  const defaultBranchId =
    currentBranchId && assignableBranches.some((branch) => branch.id === currentBranchId)
      ? currentBranchId
      : (assignableBranches[0]?.id ?? null);

  const createForm = useForm<CreateUserSchema>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
      roleId: "",
      status: "",
      branchId: "",
    },
  });

  const updateForm = useForm<UpdateUserSchema>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      roleId: "",
      status: "active",
      branchId: unassignedBranchValue,
    },
  });
  const updateRoleId = updateForm.watch("roleId");
  const canUpdateRoleUseUnassignedBranch = canRoleUseUnassignedBranch(roleOptions, updateRoleId);
  const isSelfEdit = mode === "edit" && user?.id === currentUserId;
  const createDataNotice = rolesLoading
    ? {
        title: "Roles are loading",
        message: "Wait for role options to load before creating a user.",
        variant: "default" as const,
      }
    : roleLoadError
      ? {
          title: "Roles could not be loaded",
          message: roleLoadError,
          variant: "destructive" as const,
        }
      : roleOptions.length === 0
        ? {
            title: "No roles available",
            message: "Create or load at least one role before creating a user.",
            variant: "destructive" as const,
          }
        : branchesLoading
          ? {
              title: "Branches are loading",
              message: "Wait for active branches to load before creating a user.",
              variant: "default" as const,
            }
          : branchLoadError
            ? {
                title: "Branches could not be loaded",
                message: branchLoadError,
                variant: "destructive" as const,
              }
            : assignableBranches.length === 0
              ? {
                  title: "No active branches available",
                  message: "Create or activate a branch before creating an operational user.",
                  variant: "destructive" as const,
                }
              : null;

  useEffect(() => {
    if (!open) {
      return;
    }

    if (mode === "create") {
      createForm.reset({
        fullName: "",
        email: "",
        phone: "",
        password: "",
        roleId: "",
        status: "",
        branchId: "",
      });
      return;
    }

    if (user) {
      updateForm.reset({
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        roleId: user.roleId,
        status: user.status,
        branchId: getBranchSelectValue(user.branchId),
      });
    }
  }, [createForm, mode, open, updateForm, user]);

  useEffect(() => {
    if (!open || mode !== "edit" || canUpdateRoleUseUnassignedBranch) {
      return;
    }

    if (updateForm.getValues("branchId") === unassignedBranchValue && defaultBranchId) {
      updateForm.setValue("branchId", defaultBranchId, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [canUpdateRoleUseUnassignedBranch, defaultBranchId, mode, open, updateForm]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add staff user" : "Edit staff user"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Create a new staff account connected to the existing backend users API."
              : "Update the selected staff profile, access role, and account status."}
          </DialogDescription>
        </DialogHeader>

        {mode === "create" ? (
          <Form {...createForm}>
            <form
              className="space-y-5"
              onSubmit={(event) => {
                void createForm.handleSubmit(async (values) => {
                  if (values.roleId === "") {
                    createForm.setError("roleId", {
                      message: "Please select a role before creating the user.",
                    });
                    return;
                  }

                  if (values.branchId === "" || values.branchId === unassignedBranchValue) {
                    createForm.setError("branchId", {
                      message: "Please select a branch before creating the user.",
                    });
                    return;
                  }

                  if (values.status === "") {
                    createForm.setError("status", {
                      message: "Please select the user status before saving.",
                    });
                    return;
                  }

                  await onCreate({
                    fullName: values.fullName,
                    email: values.email,
                    phone: values.phone,
                    password: values.password,
                    roleId: values.roleId,
                    branchId: getPayloadBranchId(values.branchId),
                    status: values.status,
                  });
                })(event);
              }}
            >
              <div className="grid gap-5">
                {createError ? (
                  <Alert variant="destructive">
                    <AlertTitle>User could not be created</AlertTitle>
                    <AlertDescription>{createError}</AlertDescription>
                  </Alert>
                ) : null}

                {createDataNotice ? (
                  <Alert variant={createDataNotice.variant}>
                    <AlertTitle>{createDataNotice.title}</AlertTitle>
                    <AlertDescription>{createDataNotice.message}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="grid gap-5 md:grid-cols-2">
                  <FormField
                    control={createForm.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full name</FormLabel>
                        <FormControl>
                          <Input placeholder="Amina Hassan" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="staff@bakery.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <FormField
                    control={createForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="+971 50 000 0000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Temporary password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Create a secure temporary password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <FormField
                    control={createForm.control}
                    name="roleId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {roleOptions.map((roleOption) => (
                              <SelectItem key={roleOption.id} value={roleOption.id}>
                                {roleOption.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="branchId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assigned branch</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a branch" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {assignableBranches.length === 0 ? (
                              <SelectItem disabled value={unassignedBranchValue}>
                                No active branches available
                              </SelectItem>
                            ) : null}
                            {hasNonEmptySelectValue(field.value) &&
                            field.value !== unassignedBranchValue &&
                            !hasBranchOption(assignableBranches, field.value) ? (
                              <SelectItem value={field.value}>Selected branch</SelectItem>
                            ) : null}
                            {assignableBranches.map((branch) => (
                              <SelectItem key={branch.id} value={branch.id}>
                                {branch.name} ({branch.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Select the branch intentionally before creating this account.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <FormField
                    control={createForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {statusOptions.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button onClick={onClose} type="button" variant="outline">
                  Cancel
                </Button>
                <Button disabled={createForm.formState.isSubmitting} type="submit">
                  {createForm.formState.isSubmitting ? "Creating..." : "Create user"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          <Form {...updateForm}>
            <form
              className="space-y-5"
              onSubmit={(event) => {
                void updateForm.handleSubmit(async (values) => {
                  if (!user) {
                    return;
                  }

                  if (
                    !isSelfEdit &&
                    values.branchId === unassignedBranchValue &&
                    !canRoleUseUnassignedBranch(roleOptions, values.roleId)
                  ) {
                    updateForm.setError("branchId", {
                      message: "Cashier and operational staff must be assigned to a branch.",
                    });
                    return;
                  }

                  await onUpdate(
                    user.id,
                    {
                      fullName: values.fullName,
                      phone: values.phone,
                      roleId: isSelfEdit ? null : canEditRole ? values.roleId : user.roleId,
                      branchId: isSelfEdit ? user.branchId : getPayloadBranchId(values.branchId),
                    },
                    isSelfEdit ? user.status : values.status,
                  );
                })(event);
              }}
            >
              <div className="grid gap-5">
                {isSelfEdit ? (
                  <div className="rounded-md border border-warning/30 bg-warning-tint px-4 py-3 text-sm leading-6 text-warning-text">
                    Your own role, status, branch, and email are protected. Ask another authorized
                    admin to change those fields.
                  </div>
                ) : null}

                <div className="grid gap-5 md:grid-cols-2">
                  <FormField
                    control={updateForm.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full name</FormLabel>
                        <FormControl>
                          <Input placeholder="Amina Hassan" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={updateForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            disabled={isSelfEdit}
                            readOnly
                            type="email"
                            placeholder="staff@bakery.com"
                            {...field}
                          />
                        </FormControl>
                        {isSelfEdit ? (
                          <FormDescription>Your own email cannot be changed here.</FormDescription>
                        ) : null}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <FormField
                    control={updateForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="+971 50 000 0000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={updateForm.control}
                    name="roleId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select
                          disabled={!canEditRole || isSelfEdit}
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {roleOptions.map((roleOption) => (
                              <SelectItem key={roleOption.id} value={roleOption.id}>
                                {roleOption.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {isSelfEdit ? (
                          <FormDescription>Your own role is protected.</FormDescription>
                        ) : null}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <FormField
                    control={updateForm.control}
                    name="branchId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assigned branch</FormLabel>
                        <Select
                          disabled={isSelfEdit}
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a branch" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {canUpdateRoleUseUnassignedBranch ? (
                              <SelectItem value={unassignedBranchValue}>
                                No branch assigned
                              </SelectItem>
                            ) : assignableBranches.length === 0 ? (
                              <SelectItem disabled value={unassignedBranchValue}>
                                No active branches available
                              </SelectItem>
                            ) : null}
                            {hasNonEmptySelectValue(field.value) &&
                            field.value !== unassignedBranchValue &&
                            !hasBranchOption(assignableBranches, field.value) ? (
                              <SelectItem value={field.value}>Selected branch</SelectItem>
                            ) : null}
                            {assignableBranches.map((branch) => (
                              <SelectItem key={branch.id} value={branch.id}>
                                {branch.name} ({branch.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {isSelfEdit
                            ? "Your own branch assignment is protected."
                            : "Operational staff must have a real branch. Use this field to fix users marked as needing setup."}
                        </FormDescription>
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
                        <Select
                          disabled={isSelfEdit}
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {statusOptions.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {isSelfEdit ? (
                          <FormDescription>Your own account status is protected.</FormDescription>
                        ) : null}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button onClick={onClose} type="button" variant="outline">
                  Cancel
                </Button>
                <Button disabled={updateForm.formState.isSubmitting} type="submit">
                  {updateForm.formState.isSubmitting ? "Saving..." : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
