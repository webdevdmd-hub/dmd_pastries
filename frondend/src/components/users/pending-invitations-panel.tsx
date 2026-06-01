"use client";

import { MailCheck, MoreHorizontal } from "lucide-react";
import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { StaffInvitation } from "@/types/invitation";

type PendingInvitationsPanelProps = {
  canManage: boolean;
  invitations: StaffInvitation[];
  isLoading: boolean;
  onCancel: (invitation: StaffInvitation) => void;
  onResend: (invitation: StaffInvitation) => void;
};

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(date);
}

export function PendingInvitationsPanel({
  canManage,
  invitations,
  isLoading,
  onCancel,
  onResend,
}: PendingInvitationsPanelProps): JSX.Element {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <MailCheck className="h-5 w-5 text-brand-caramel" />
            Pending invitations
          </CardTitle>
          <CardDescription>
            Track staff onboarding links before accounts are activated.
          </CardDescription>
        </div>
        <Badge variant="secondary">{invitations.length} pending</Badge>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm text-brand-mocha">Loading invitations...</p> : null}

        {!isLoading && invitations.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-brand-cappuccino bg-brand-latte/60 p-5 text-sm text-brand-mocha">
            No pending staff invitations.
          </p>
        ) : null}

        {!isLoading && invitations.length > 0 ? (
          <div className="grid gap-3">
            {invitations.map((invitation) => (
              <article
                className="flex flex-col gap-3 rounded-3xl border border-brand-cappuccino bg-brand-latte/70 p-4 md:flex-row md:items-center md:justify-between"
                key={invitation.id}
              >
                <div>
                  <h3 className="font-semibold text-brand-espresso">{invitation.fullName}</h3>
                  <p className="mt-1 text-sm text-brand-mocha">{invitation.email}</p>
                  <p className="mt-1 text-xs text-brand-mocha">
                    Expires {formatDate(invitation.expiresAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="capitalize">{invitation.status}</Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        aria-label={`Open invitation actions for ${invitation.fullName}`}
                        disabled={!canManage}
                        size="icon"
                        variant="ghost"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onResend(invitation)}>
                        Resend invitation
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onCancel(invitation)}>
                        Cancel invitation
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
