"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import type { JSX } from "react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

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
import { type InviteUserSchema, inviteUserSchema } from "@/lib/validators/user.schema";
import type { Branch } from "@/types/branch";
import type { CreateStaffInvitationPayload } from "@/types/invitation";
import type { UserRoleOption } from "@/types/user";

type InviteUserDialogProps = {
  branches: Branch[];
  isSubmitting: boolean;
  onClose: () => void;
  onInvite: (payload: CreateStaffInvitationPayload) => Promise<void>;
  open: boolean;
  roleOptions: UserRoleOption[];
};

const unassignedBranchValue = "__unassigned__";

function isBranchOptionalRoleName(roleName: string): boolean {
  const normalizedRoleName = roleName.trim().toLowerCase();

  return normalizedRoleName.includes("admin") || normalizedRoleName.includes("owner");
}

function canRoleUseUnassignedBranch(roleOptions: UserRoleOption[], roleId: string): boolean {
  const role = roleOptions.find((roleOption) => roleOption.id === roleId);

  return role ? isBranchOptionalRoleName(role.name) : false;
}

export function InviteUserDialog({
  branches,
  isSubmitting,
  onClose,
  onInvite,
  open,
  roleOptions,
}: InviteUserDialogProps): JSX.Element {
  const form = useForm<InviteUserSchema>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      roleId: "",
      branchId: unassignedBranchValue,
    },
  });
  const selectedRoleId = form.watch("roleId");
  const canSelectedRoleUseUnassignedBranch = canRoleUseUnassignedBranch(
    roleOptions,
    selectedRoleId,
  );

  useEffect(() => {
    if (open) {
      form.reset({
        fullName: "",
        email: "",
        phone: "",
        roleId: roleOptions[0]?.id ?? "",
        branchId: branches[0]?.id ?? unassignedBranchValue,
      });
    }
  }, [branches, form, open, roleOptions]);

  useEffect(() => {
    if (!open || canSelectedRoleUseUnassignedBranch) {
      return;
    }

    if (form.getValues("branchId") === unassignedBranchValue && branches[0]?.id) {
      form.setValue("branchId", branches[0].id, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [branches, canSelectedRoleUseUnassignedBranch, form, open]);

  const handleSubmit = form.handleSubmit(async (values) => {
    if (
      values.branchId === unassignedBranchValue &&
      !canRoleUseUnassignedBranch(roleOptions, values.roleId)
    ) {
      form.setError("branchId", {
        message: "Cashier and operational staff must be assigned to a branch.",
      });
      return;
    }

    await onInvite({
      fullName: values.fullName,
      email: values.email,
      phone: values.phone.trim().length > 0 ? values.phone : null,
      roleId: values.roleId,
      branchId: values.branchId === unassignedBranchValue ? null : values.branchId,
    });
  });

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
          <DialogTitle>Invite staff user</DialogTitle>
          <DialogDescription>
            Send an invitation so staff can activate their own account securely.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className="space-y-5"
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
          >
            <div className="grid gap-5 md:grid-cols-2">
              <FormField
                control={form.control}
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
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="staff@bakery.com" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <FormField
                control={form.control}
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
                control={form.control}
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
            </div>

            <FormField
              control={form.control}
              name="branchId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Branch</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a branch" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {canSelectedRoleUseUnassignedBranch ? (
                        <SelectItem value={unassignedBranchValue}>No branch assigned</SelectItem>
                      ) : branches.length === 0 ? (
                        <SelectItem disabled value={unassignedBranchValue}>
                          No active branches available
                        </SelectItem>
                      ) : null}
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Operational staff must have a real branch. Branchless invitations are only for
                    owner/admin setup cases.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button onClick={onClose} type="button" variant="outline">
                Cancel
              </Button>
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Sending
                  </>
                ) : (
                  "Send invitation"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
