"use client";

import { RefreshCw, RotateCcw, Save, ShieldAlert, Trash2 } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useSuperAdminUserHardDeletePreview,
  useUpdateSuperAdminUserAction,
} from "@/hooks/use-super-admin";
import { getErrorMessage } from "@/lib/api/client";
import type { SuperAdminBusinessDetail, SuperAdminUserDetail } from "@/types/super-admin";

type UserActionPanelProps = {
  detail: SuperAdminUserDetail;
  business: SuperAdminBusinessDetail | undefined;
};

const statuses = ["active", "inactive", "suspended", "invited"];

export function SuperAdminUserActionPanel({ detail, business }: UserActionPanelProps): JSX.Element {
  const mutation = useUpdateSuperAdminUserAction(detail.user.id);
  const hardDeletePreviewQuery = useSuperAdminUserHardDeletePreview(detail.user.id);
  const [fullName, setFullName] = useState(detail.user.fullName);
  const [email, setEmail] = useState(detail.user.email);
  const [phone, setPhone] = useState(detail.user.phone);
  const [status, setStatus] = useState(detail.user.status);
  const [roleId, setRoleId] = useState(detail.user.roleId);
  const [branchId, setBranchId] = useState(detail.user.branchId ?? "");
  const [canAccessAllBranches, setCanAccessAllBranches] = useState(
    detail.user.canAccessAllBranches,
  );
  const [branchAccessIds, setBranchAccessIds] = useState<string[]>(
    detail.branchAccess.map((branch) => branch.id),
  );
  const [reason, setReason] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const [dangerReason, setDangerReason] = useState("");
  const [hardDeleteConfirmation, setHardDeleteConfirmation] = useState("");
  const [hardDeleteReason, setHardDeleteReason] = useState("");

  useEffect(() => {
    setFullName(detail.user.fullName);
    setEmail(detail.user.email);
    setPhone(detail.user.phone);
    setStatus(detail.user.status);
    setRoleId(detail.user.roleId);
    setBranchId(detail.user.branchId ?? "");
    setCanAccessAllBranches(detail.user.canAccessAllBranches);
    setBranchAccessIds(detail.branchAccess.map((branch) => branch.id));
    setReason("");
    setConfirmationText("");
    setDangerReason("");
    setHardDeleteConfirmation("");
    setHardDeleteReason("");
  }, [detail]);

  const availableBranches = business?.branches ?? detail.branchAccess;
  const availableRoles = business?.roles.filter((role) => !role.deletedAt) ?? [];
  const branchAccessChanged = useMemo(() => {
    const originalBranchAccess = [...detail.branchAccess.map((branch) => branch.id)].sort();
    const nextBranchAccess = [...branchAccessIds].sort();

    return originalBranchAccess.join("|") !== nextBranchAccess.join("|");
  }, [branchAccessIds, detail.branchAccess]);
  const hasChanges = useMemo(() => {
    return (
      fullName.trim() !== detail.user.fullName ||
      email.trim().toLowerCase() !== detail.user.email ||
      phone.trim() !== detail.user.phone ||
      status !== detail.user.status ||
      roleId !== detail.user.roleId ||
      branchId !== (detail.user.branchId ?? "") ||
      canAccessAllBranches !== detail.user.canAccessAllBranches ||
      branchAccessChanged
    );
  }, [
    branchAccessChanged,
    branchId,
    canAccessAllBranches,
    detail,
    email,
    fullName,
    phone,
    roleId,
    status,
  ]);

  const reasonIsReady = reason.trim().length >= 10;
  const canSubmit = hasChanges && reasonIsReady && !mutation.isPending;
  const isDeleted = detail.user.deletedAt !== null;
  const dangerReasonIsReady = dangerReason.trim().length >= 10;
  const confirmationIsReady = confirmationText.trim() === detail.user.email;
  const canSubmitDanger = dangerReasonIsReady && confirmationIsReady && !mutation.isPending;
  const hardDeletePreview = hardDeletePreviewQuery.data;
  const hardDeleteReasonIsReady = hardDeleteReason.trim().length >= 10;
  const hardDeleteConfirmationIsReady =
    hardDeleteConfirmation.trim() === hardDeletePreview?.requiredConfirmText;
  const canSubmitHardDelete =
    hardDeletePreview?.canHardDelete === true &&
    hardDeleteReasonIsReady &&
    hardDeleteConfirmationIsReady &&
    !mutation.isPending;

  function toggleBranchAccess(branchIdValue: string, checked: boolean): void {
    setBranchAccessIds((current) => {
      if (checked) {
        return current.includes(branchIdValue) ? current : [...current, branchIdValue];
      }
      return current.filter((id) => id !== branchIdValue);
    });
  }

  function submitAction(): void {
    const body = {
      reason: reason.trim(),
      ...(fullName.trim() !== detail.user.fullName ? { full_name: fullName.trim() } : {}),
      ...(email.trim().toLowerCase() !== detail.user.email
        ? { email: email.trim().toLowerCase() }
        : {}),
      ...(phone.trim() !== detail.user.phone ? { phone: phone.trim() } : {}),
      ...(status !== detail.user.status ? { status } : {}),
      ...(roleId !== detail.user.roleId ? { role_id: roleId } : {}),
      ...(branchId !== (detail.user.branchId ?? "") ? { branch_id: branchId } : {}),
      ...(canAccessAllBranches !== detail.user.canAccessAllBranches
        ? { can_access_all_branches: canAccessAllBranches }
        : {}),
      ...(branchAccessChanged ? { branch_access_ids: branchAccessIds } : {}),
    };

    mutation.mutate(body, {
      onSuccess: () => {
        setReason("");
      },
    });
  }

  function submitDangerAction(operation: "restore" | "soft_delete"): void {
    mutation.mutate(
      {
        operation,
        reason: dangerReason.trim(),
        confirmation_text: confirmationText.trim(),
      },
      {
        onSuccess: () => {
          setConfirmationText("");
          setDangerReason("");
        },
      },
    );
  }

  function submitHardDelete(): void {
    mutation.mutate(
      {
        operation: "hard_delete",
        reason: hardDeleteReason.trim(),
        confirmation_text: hardDeleteConfirmation.trim(),
      },
      {
        onSuccess: () => {
          setHardDeleteConfirmation("");
          setHardDeleteReason("");
        },
      },
    );
  }

  return (
    <Card className="border-stone-300 shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4" />
          Controlled Admin Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-amber-200 bg-amber-50 text-amber-950">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Audit required</AlertTitle>
          <AlertDescription>
            These actions update tenant access and write a platform audit snapshot with your reason.
          </AlertDescription>
        </Alert>

        {mutation.error ? (
          <Alert variant="destructive">
            <AlertTitle>Action failed</AlertTitle>
            <AlertDescription>{getErrorMessage(mutation.error)}</AlertDescription>
          </Alert>
        ) : null}

        {isDeleted ? (
          <Alert className="border-stone-300 bg-stone-50 text-stone-800">
            <AlertTitle>User is soft deleted</AlertTitle>
            <AlertDescription>
              Restore this user before changing profile or access fields.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          <Field label="Full name">
            <Input
              disabled={isDeleted}
              onChange={(event) => setFullName(event.target.value)}
              value={fullName}
            />
          </Field>
          <Field label="Local email">
            <Input
              disabled={isDeleted}
              onChange={(event) => setEmail(event.target.value)}
              value={email}
            />
          </Field>
          <Field label="Phone">
            <Input
              disabled={isDeleted}
              onChange={(event) => setPhone(event.target.value)}
              value={phone}
            />
          </Field>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Status">
            <Select disabled={isDeleted} onValueChange={setStatus} value={status}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Role">
            <Select disabled={isDeleted} onValueChange={setRoleId} value={roleId}>
              <SelectTrigger>
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.roleName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Primary branch">
            <Select disabled={isDeleted} onValueChange={setBranchId} value={branchId}>
              <SelectTrigger>
                <SelectValue placeholder="Primary branch" />
              </SelectTrigger>
              <SelectContent>
                {availableBranches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.branchName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="flex items-center gap-3 rounded-md border border-stone-200 bg-white p-3">
            <Checkbox
              checked={canAccessAllBranches}
              disabled={isDeleted}
              id="all-branch-access"
              onCheckedChange={(checked) => setCanAccessAllBranches(checked === true)}
            />
            <Label htmlFor="all-branch-access">Can access all branches</Label>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Explicit branch access</Label>
          <div className="grid gap-2 md:grid-cols-2">
            {availableBranches.map((branch) => (
              <label
                className="flex items-center gap-3 rounded-md border border-stone-200 bg-white p-3 text-sm"
                key={branch.id}
              >
                <Checkbox
                  checked={branchAccessIds.includes(branch.id)}
                  disabled={isDeleted}
                  onCheckedChange={(checked) => toggleBranchAccess(branch.id, checked === true)}
                />
                <span>
                  <span className="block font-medium text-brand-espresso">{branch.branchName}</span>
                  <span className="text-xs text-stone-500">{branch.code}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <Field label="Reason">
          <Textarea
            onChange={(event) => setReason(event.target.value)}
            placeholder="Type why this Super Admin action is needed"
            value={reason}
          />
        </Field>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-stone-500">
            {hasChanges ? "Changes are ready for audited submit." : "No changes selected."}
          </p>
          <Button disabled={!canSubmit} onClick={submitAction} type="button">
            <Save className="h-4 w-4" />
            Apply audited action
          </Button>
        </div>

        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-semibold text-red-950">
                {isDeleted ? "Restore user" : "Soft delete user"}
              </p>
              <p className="mt-1 text-sm leading-6 text-red-900">
                Type <span className="font-semibold">{detail.user.email}</span> and provide a
                reason. This does not hard delete database records.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <Field label="Typed confirmation">
              <Input
                onChange={(event) => setConfirmationText(event.target.value)}
                placeholder={detail.user.email}
                value={confirmationText}
              />
            </Field>
            <Field label="Delete/restore reason">
              <Textarea
                className="min-h-11"
                onChange={(event) => setDangerReason(event.target.value)}
                placeholder="Type why this destructive action is needed"
                value={dangerReason}
              />
            </Field>
          </div>
          <div className="mt-4 flex justify-end">
            {isDeleted ? (
              <Button
                disabled={!canSubmitDanger}
                onClick={() => submitDangerAction("restore")}
                type="button"
              >
                <RotateCcw className="h-4 w-4" />
                Restore user
              </Button>
            ) : (
              <Button
                className="bg-red-700 text-white hover:bg-red-800"
                disabled={!canSubmitDanger}
                onClick={() => submitDangerAction("soft_delete")}
                type="button"
              >
                <Trash2 className="h-4 w-4" />
                Soft delete user
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-md border border-red-300 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-semibold text-red-950">Hard delete guard</p>
              <p className="mt-1 text-sm leading-6 text-red-900">
                Hard delete permanently removes the local user row. It is only enabled after the
                backend confirms there are no blocking records.
              </p>
            </div>
            <Button
              onClick={() => {
                void hardDeletePreviewQuery.refetch();
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              <RefreshCw className="h-4 w-4" />
              Preview
            </Button>
          </div>

          {hardDeletePreviewQuery.error ? (
            <Alert className="mt-4" variant="destructive">
              <AlertTitle>Preview failed</AlertTitle>
              <AlertDescription>{getErrorMessage(hardDeletePreviewQuery.error)}</AlertDescription>
            </Alert>
          ) : null}

          {hardDeletePreview ? (
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <GuardMetric label="Decision" value={hardDeletePreview.decision} />
                <GuardMetric
                  label="Blocking rows"
                  value={String(hardDeletePreview.totalBlockingRows)}
                />
                <GuardMetric
                  label="Cleanup rows"
                  value={String(hardDeletePreview.totalCleanupRows)}
                />
              </div>

              {hardDeletePreview.requiresSoftDelete ? (
                <Alert className="border-amber-200 bg-amber-50 text-amber-950">
                  <AlertTitle>Soft delete required first</AlertTitle>
                  <AlertDescription>
                    Use soft delete before requesting a hard delete preview approval.
                  </AlertDescription>
                </Alert>
              ) : null}

              {hardDeletePreview.blockingCounts.length > 0 ? (
                <div>
                  <p className="text-sm font-semibold text-red-950">Blocking records</p>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    {hardDeletePreview.blockingCounts.map((item) => (
                      <RelatedCountItem item={item} key={`${item.module}-${item.table}`} />
                    ))}
                  </div>
                </div>
              ) : null}

              {hardDeletePreview.cleanupCounts.length > 0 ? (
                <div>
                  <p className="text-sm font-semibold text-stone-800">Cleanup path records</p>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    {hardDeletePreview.cleanupCounts.map((item) => (
                      <RelatedCountItem item={item} key={`${item.module}-${item.table}`} />
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-3 lg:grid-cols-2">
                <Field label="Hard delete confirmation">
                  <Input
                    onChange={(event) => setHardDeleteConfirmation(event.target.value)}
                    placeholder={hardDeletePreview.requiredConfirmText}
                    value={hardDeleteConfirmation}
                  />
                </Field>
                <Field label="Hard delete reason">
                  <Textarea
                    className="min-h-11"
                    onChange={(event) => setHardDeleteReason(event.target.value)}
                    placeholder="Type why permanent deletion is required"
                    value={hardDeleteReason}
                  />
                </Field>
              </div>

              <div className="flex justify-end">
                <Button
                  className="bg-red-900 text-white hover:bg-red-950"
                  disabled={!canSubmitHardDelete}
                  onClick={submitHardDelete}
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                  Hard delete permanently
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ children, label }: { children: JSX.Element; label: string }): JSX.Element {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function GuardMetric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">{label}</p>
      <p className="mt-2 break-words font-semibold text-brand-espresso">{value}</p>
    </div>
  );
}

function RelatedCountItem({
  item,
}: {
  item: { module: string; table: string; count: number };
}): JSX.Element {
  return (
    <div className="rounded-md border border-stone-200 bg-white p-3">
      <p className="text-sm font-semibold text-brand-espresso">{item.module}</p>
      <p className="mt-1 font-mono text-xs text-stone-500">{item.table}</p>
      <p className="mt-2 text-lg font-semibold">{item.count}</p>
    </div>
  );
}
