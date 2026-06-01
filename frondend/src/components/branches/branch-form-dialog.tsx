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
import { type BranchSchema, branchSchema } from "@/lib/validators/branch.schema";
import type { Branch, CreateBranchPayload } from "@/types/branch";
import type { User } from "@/types/user";

type BranchFormDialogProps = {
  branch: Branch | null;
  isSubmitting: boolean;
  managerOptions: User[];
  mode: "create" | "edit";
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateBranchPayload) => Promise<void>;
  open: boolean;
};

const defaultValues: BranchSchema = {
  name: "",
  code: "",
  managerUserId: "",
  phone: "",
  email: "",
  address: "",
  timezone: "Asia/Dubai",
  status: "active",
};

function toFormValues(branch: Branch | null): BranchSchema {
  if (!branch) {
    return defaultValues;
  }

  return {
    name: branch.name,
    code: branch.code,
    managerUserId: branch.managerUserId ?? "",
    phone: branch.phone ?? "",
    email: branch.email ?? "",
    address: branch.address,
    timezone: branch.timezone,
    status: branch.status,
  };
}

function toPayload(values: BranchSchema): CreateBranchPayload {
  return {
    name: values.name.trim(),
    code: values.code.trim(),
    managerUserId: values.managerUserId.trim().length > 0 ? values.managerUserId.trim() : null,
    phone: values.phone.trim().length > 0 ? values.phone.trim() : null,
    email: values.email.trim().length > 0 ? values.email.trim() : null,
    address: values.address.trim(),
    timezone: values.timezone.trim(),
    status: values.status,
  };
}

export function BranchFormDialog({
  branch,
  isSubmitting,
  managerOptions,
  mode,
  onOpenChange,
  onSubmit,
  open,
}: BranchFormDialogProps): JSX.Element {
  const form = useForm<BranchSchema>({
    resolver: zodResolver(branchSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) {
      form.reset(toFormValues(branch));
    }
  }, [branch, form, open]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(toPayload(values));
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create branch" : "Edit branch"}</DialogTitle>
          <DialogDescription>
            Manage branch location details used for staff assignment and branch-level operations.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Branch name</FormLabel>
                  <FormControl>
                    <Input placeholder="Main Branch" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Branch code</FormLabel>
                  <FormControl>
                    <Input placeholder="MAIN" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="+971500000000" {...field} />
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
                    <Input placeholder="branch@bakery.com" type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="managerUserId"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Branch manager</FormLabel>
                  <Select
                    value={field.value || "none"}
                    onValueChange={(value) => {
                      field.onChange(value === "none" ? "" : value);
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select manager" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No manager assigned</SelectItem>
                      {managerOptions.map((manager) => (
                        <SelectItem key={manager.id} value={manager.id}>
                          {manager.fullName} - {manager.roleName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input placeholder="Dubai Mall, Dubai" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Timezone</FormLabel>
                  <FormControl>
                    <Input placeholder="Asia/Dubai" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
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
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="md:col-span-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                }}
              >
                Cancel
              </Button>
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Saving
                  </>
                ) : mode === "create" ? (
                  "Create branch"
                ) : (
                  "Save changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
