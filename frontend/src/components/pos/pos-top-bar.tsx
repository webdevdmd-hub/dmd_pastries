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
    <header className="grid h-16 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center border-b border-zinc-300 bg-zinc-50 px-4 text-zinc-950 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
      <div className="flex min-w-0 items-center gap-3">
        {onMenuClick ? (
          <Button
            aria-label="Open POS menu"
            className="h-10 w-10 rounded-md border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100"
            onClick={onMenuClick}
            size="icon"
            type="button"
            variant="outline"
          >
            <Menu className="h-5 w-5" />
          </Button>
        ) : null}
        <div>
          <p className="text-base font-black tracking-tight text-zinc-950">POS Billing</p>
          <p className="text-xs font-medium text-zinc-500 lg:hidden">{branchName}</p>
        </div>
      </div>

      <div className="hidden min-w-[16rem] text-right lg:block">
        <p className="text-sm font-black text-zinc-950">
          {cashierName} - {branchName}
        </p>
        <p className="font-mono text-xs text-zinc-600">
          {clock.toLocaleTimeString("en-AE", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
          , {clock.toLocaleDateString("en-AE", { dateStyle: "medium" })}
        </p>
      </div>

      <div className="flex min-w-0 items-center justify-end gap-3">
        <div className="hidden border-l border-zinc-300 pl-4 text-sm sm:block">
          <p className="font-medium text-zinc-900">Admin User</p>
          <p className="flex items-center gap-1.5 text-zinc-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Connected
          </p>
        </div>
        <Button
          aria-label="Notifications"
          className="hidden h-10 w-10 rounded-md border-transparent bg-transparent text-zinc-900 hover:bg-zinc-100 md:inline-flex"
          size="icon"
          type="button"
          variant="ghost"
        >
          <Bell className="h-4 w-4" />
        </Button>
        <Button
          asChild
          className="hidden h-10 rounded-md bg-black px-4 text-sm font-black text-white hover:bg-zinc-800 sm:inline-flex"
          variant="default"
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
              className="h-10 w-10 rounded-full border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100"
              size="icon"
              variant="outline"
            >
              <UserRound className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              <span className="block">{user?.fullName ?? "Cashier"}</span>
              <span className="block text-xs font-normal text-zinc-500">
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
