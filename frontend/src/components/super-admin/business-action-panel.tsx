"use client";

import { Building2, Save, ShieldAlert } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useUpdateSuperAdminBusinessAction } from "@/hooks/use-super-admin";
import { getErrorMessage } from "@/lib/api/client";
import type { SuperAdminBusinessDetail } from "@/types/super-admin";

type BusinessActionPanelProps = {
  detail: SuperAdminBusinessDetail;
};

const businessStatuses = ["active", "inactive", "suspended"];

export function SuperAdminBusinessActionPanel({ detail }: BusinessActionPanelProps): JSX.Element {
  const mutation = useUpdateSuperAdminBusinessAction(detail.business.id);
  const [businessName, setBusinessName] = useState(detail.business.businessName);
  const [currency, setCurrency] = useState(detail.business.currency);
  const [timezone, setTimezone] = useState(detail.business.timezone);
  const [vatNumber, setVatNumber] = useState(detail.business.vatNumber);
  const [status, setStatus] = useState(detail.business.status);
  const [ownerUserId, setOwnerUserId] = useState(detail.business.ownerUserId ?? "");
  const [reason, setReason] = useState("");

  useEffect(() => {
    setBusinessName(detail.business.businessName);
    setCurrency(detail.business.currency);
    setTimezone(detail.business.timezone);
    setVatNumber(detail.business.vatNumber);
    setStatus(detail.business.status);
    setOwnerUserId(detail.business.ownerUserId ?? "");
    setReason("");
  }, [detail]);

  const ownerCandidates = useMemo(
    () =>
      detail.users.filter(
        (user) =>
          user.status === "active" &&
          user.deletedAt === null &&
          (user.roleName.toLowerCase().includes("admin") ||
            user.roleName.toLowerCase().includes("owner")),
      ),
    [detail.users],
  );

  const hasChanges =
    businessName.trim() !== detail.business.businessName ||
    currency.trim().toUpperCase() !== detail.business.currency ||
    timezone.trim() !== detail.business.timezone ||
    vatNumber.trim() !== detail.business.vatNumber ||
    status !== detail.business.status ||
    ownerUserId !== (detail.business.ownerUserId ?? "");
  const canSubmit = hasChanges && reason.trim().length >= 10 && !mutation.isPending;

  function submitAction(): void {
    mutation.mutate(
      {
        reason: reason.trim(),
        ...(businessName.trim() !== detail.business.businessName
          ? { business_name: businessName.trim() }
          : {}),
        ...(currency.trim().toUpperCase() !== detail.business.currency
          ? { currency: currency.trim().toUpperCase() }
          : {}),
        ...(timezone.trim() !== detail.business.timezone ? { timezone: timezone.trim() } : {}),
        ...(vatNumber.trim() !== detail.business.vatNumber ? { vat_number: vatNumber.trim() } : {}),
        ...(status !== detail.business.status ? { status } : {}),
        ...(ownerUserId !== (detail.business.ownerUserId ?? "")
          ? { owner_user_id: ownerUserId }
          : {}),
      },
      {
        onSuccess: () => {
          setReason("");
        },
      },
    );
  }

  return (
    <Card className="border-border shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Business Admin Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-warning/30 bg-warning-tint text-warning-text">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Platform audit required</AlertTitle>
          <AlertDescription>
            These actions change tenant-level configuration and write a platform audit snapshot.
          </AlertDescription>
        </Alert>

        {mutation.error ? (
          <Alert variant="destructive">
            <AlertTitle>Action failed</AlertTitle>
            <AlertDescription>{getErrorMessage(mutation.error)}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          <Field label="Business name">
            <Input onChange={(event) => setBusinessName(event.target.value)} value={businessName} />
          </Field>
          <Field label="Currency">
            <Input onChange={(event) => setCurrency(event.target.value)} value={currency} />
          </Field>
          <Field label="Timezone">
            <Input onChange={(event) => setTimezone(event.target.value)} value={timezone} />
          </Field>
          <Field label="VAT number">
            <Input onChange={(event) => setVatNumber(event.target.value)} value={vatNumber} />
          </Field>
          <Field label="Business status">
            <Select onValueChange={setStatus} value={status}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {businessStatuses.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Owner/admin">
            <Select onValueChange={setOwnerUserId} value={ownerUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Owner/admin user" />
              </SelectTrigger>
              <SelectContent>
                {ownerCandidates.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label="Reason">
          <Textarea
            onChange={(event) => setReason(event.target.value)}
            placeholder="Type why this business action is needed"
            value={reason}
          />
        </Field>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground-muted">
            {hasChanges ? "Business changes are ready for audited submit." : "No changes selected."}
          </p>
          <Button disabled={!canSubmit} onClick={submitAction} type="button">
            <Save className="h-4 w-4" />
            Apply business action
          </Button>
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
