"use client";

import { Bell, LayoutDashboard, LogOut, Menu, UserRound } from "lucide-react";
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
    <header className="flex h-[4.5rem] shrink-0 items-center justify-between border-b border-brand-cappuccino/60 bg-white/80 px-5 text-brand-espresso shadow-sm backdrop-blur-xl">
      <div className="flex items-center gap-3">
        {onMenuClick ? (
          <Button
            aria-label="Open POS menu"
            className="h-11 w-11 rounded-full border-brand-cappuccino bg-brand-latte text-brand-espresso hover:bg-brand-cappuccino/40"
            onClick={onMenuClick}
            size="icon"
            type="button"
            variant="outline"
          >
            <Menu className="h-5 w-5" />
          </Button>
        ) : null}
        <div>
          <p className="font-display text-3xl font-bold leading-none text-brand-espresso">
            POS Billing
          </p>
          <p className="text-xs font-medium text-brand-mocha">
            {cashierName} - {branchName}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden rounded-2xl bg-brand-latte px-4 py-2 text-right text-sm sm:block">
          <p className="font-bold text-brand-espresso">
            {clock.toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="text-xs text-brand-mocha">
            {clock.toLocaleDateString("en-AE", { dateStyle: "medium" })}
          </p>
        </div>
        <Button
          aria-label="Notifications"
          className="hidden h-11 w-11 rounded-full border-brand-cappuccino bg-white text-brand-espresso hover:bg-brand-latte md:inline-flex"
          size="icon"
          type="button"
          variant="outline"
        >
          <Bell className="h-4 w-4" />
        </Button>
        <Button
          asChild
          className="hidden rounded-full border-brand-cappuccino bg-white text-brand-espresso hover:bg-brand-latte sm:inline-flex"
          variant="outline"
        >
          <Link href={ROUTES.dashboard}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Exit POS
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label="Open user menu"
              className="h-11 w-11 rounded-full border-brand-cappuccino bg-brand-caramel text-white hover:bg-brand-mocha"
              size="icon"
              variant="default"
            >
              <UserRound className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              <span className="block">{user?.fullName ?? "Cashier"}</span>
              <span className="block text-xs font-normal text-brand-mocha">
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
