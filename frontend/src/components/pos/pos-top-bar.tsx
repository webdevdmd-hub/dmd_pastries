"use client";

import { Bell, LogOut, Menu, UserRound } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";
import { useEffect, useState } from "react";

import { ThemeSelector } from "@/components/theme/theme-selector";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";

type POSTopBarProps = {
  branchName: string;
  cashierName: string;
  onMenuClick?: () => void;
};

export function POSTopBar({ branchName, cashierName, onMenuClick }: POSTopBarProps): JSX.Element {
  const { logout, user } = useAuth();
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <header className="grid h-16 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center border-b border-border bg-card px-4 text-foreground lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
      <div className="flex min-w-0 items-center gap-3">
        {onMenuClick ? (
          <Button
            aria-label="Open POS menu"
            className="min-h-tap min-w-tap rounded border-border bg-card text-foreground hover:bg-muted"
            onClick={onMenuClick}
            size="icon"
            type="button"
            variant="outline"
          >
            <Menu className="h-5 w-5" />
          </Button>
        ) : null}
        <div>
          <p className="text-title text-foreground">POS Billing</p>
          <p className="text-meta text-foreground-muted lg:hidden">{branchName}</p>
        </div>
      </div>

      <div className="hidden min-w-[16rem] text-right lg:block">
        <p className="text-body font-medium text-foreground">
          {cashierName} - {branchName}
        </p>
        {/* tabular-nums so the clock does not reflow every second as digit
            widths change. It ticks once a second; without it the whole header
            shifts, which is exactly the kind of motion a cashier reads as lag. */}
        <p className="text-meta font-mono tabular-nums text-foreground-muted">
          {clock.toLocaleTimeString("en-AE", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
          , {clock.toLocaleDateString("en-AE", { dateStyle: "medium" })}
        </p>
      </div>

      <div className="flex min-w-0 items-center justify-end gap-3">
        <div className="text-body hidden border-l border-border pl-4 sm:block">
          <p className="font-medium text-foreground">Admin User</p>
          <p className="flex items-center gap-1.5 text-foreground-muted">
            <span className="h-2 w-2 rounded-full bg-money" />
            Connected
          </p>
        </div>
        <Button
          aria-label="Notifications"
          className="min-h-tap min-w-tap hidden rounded border-transparent bg-transparent text-foreground-muted hover:bg-muted md:inline-flex"
          size="icon"
          type="button"
          variant="ghost"
        >
          <Bell className="h-4 w-4" />
        </Button>
        {/* Demoted from a solid black fill. As a filled primary this was the
            highest-contrast control on the counter screen — louder than Complete
            checkout, which is the one action that takes money. Leaving the till
            is not the primary action on a till (DESIGN.md §3.2, §6). */}
        <Button
          asChild
          className="min-h-tap text-body hidden rounded border-border bg-card px-4 font-medium text-foreground hover:bg-muted sm:inline-flex"
          variant="outline"
        >
          <Link href={ROUTES.dashboard}>
            <LogOut className="mr-2 h-4 w-4" />
            Exit POS
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label="Open user menu"
              className="min-h-tap min-w-tap rounded-full border-border bg-card text-foreground hover:bg-muted"
              size="icon"
              variant="outline"
            >
              <UserRound className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              <span className="block">{user?.fullName ?? "Cashier"}</span>
              <span className="text-meta block font-normal text-foreground-muted">
                {user?.email ?? "Signed in"}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={ROUTES.profile}>Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={ROUTES.dashboard}>Dashboard</Link>
            </DropdownMenuItem>
            <ThemeSelector />
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                void logout();
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
