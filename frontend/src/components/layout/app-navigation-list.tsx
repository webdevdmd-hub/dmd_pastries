"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  type AppNavigationGroup,
  appNavigationGroups,
  type AppNavigationItem,
} from "@/components/layout/app-navigation";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ROUTES } from "@/constants/routes";
import { usePermission } from "@/hooks/use-permission";
import { cn } from "@/lib/utils/cn";

const NAV_OPEN_GROUPS_STORAGE_KEY = "pos.nav.open-groups";

type AppNavigationListProps = {
  collapsed?: boolean;
  onNavigate?: () => void;
  theme?: "default" | "pos";
};

type VisibleNavigationGroup = {
  items: AppNavigationItem[];
  label: string;
};

function canAccessItem(
  item: AppNavigationItem,
  hasPermission: ReturnType<typeof usePermission>["hasPermission"],
  hasAnyPermission: ReturnType<typeof usePermission>["hasAnyPermission"],
): boolean {
  if (item.permission) {
    return hasPermission(item.permission);
  }

  if (item.permissionAny) {
    return hasAnyPermission([...item.permissionAny]);
  }

  return true;
}

function getVisibleGroups(
  groups: readonly AppNavigationGroup[],
  hasPermission: ReturnType<typeof usePermission>["hasPermission"],
  hasAnyPermission: ReturnType<typeof usePermission>["hasAnyPermission"],
): VisibleNavigationGroup[] {
  return groups
    .map((group) => {
      const items = group.items
        .map((item) => {
          const children =
            item.children?.filter((child) =>
              canAccessItem(child, hasPermission, hasAnyPermission),
            ) ?? [];

          return {
            ...item,
            ...(children.length > 0 ? { children } : {}),
          };
        })
        .filter(
          (item) =>
            canAccessItem(item, hasPermission, hasAnyPermission) ||
            (item.children?.length ?? 0) > 0,
        );

      return {
        label: group.label,
        items,
      };
    })
    .filter((group) => group.items.length > 0);
}

function itemMatchesPath(item: AppNavigationItem, pathname: string): boolean {
  if (pathname === item.href) {
    return true;
  }

  return item.href !== ROUTES.dashboard && pathname.startsWith(`${item.href}/`);
}

function isCurrentItem(
  item: AppNavigationItem,
  pathname: string,
  visibleItems: readonly AppNavigationItem[],
): boolean {
  if (!itemMatchesPath(item, pathname)) {
    return false;
  }

  return !visibleItems.some(
    (otherItem) => otherItem.href !== item.href && itemMatchesPath(otherItem, pathname),
  );
}

function itemOrChildMatchesPath(item: AppNavigationItem, pathname: string): boolean {
  return (
    itemMatchesPath(item, pathname) ||
    (item.children?.some((child) => itemMatchesPath(child, pathname)) ?? false)
  );
}

function NavigationTooltip({
  children,
  collapsed,
  label,
}: {
  children: JSX.Element;
  collapsed: boolean;
  label: string;
}): JSX.Element {
  if (!collapsed) {
    return children;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

export function AppNavigationList({
  collapsed = false,
  onNavigate,
  theme = "default",
}: AppNavigationListProps): JSX.Element {
  const pathname = usePathname();
  const isPosTheme = theme === "pos";
  const { hasAnyPermission, hasPermission } = usePermission();
  const visibleGroups = useMemo(
    () => getVisibleGroups(appNavigationGroups, hasPermission, hasAnyPermission),
    [hasAnyPermission, hasPermission],
  );
  const visibleItems = useMemo(
    () =>
      visibleGroups.flatMap((group) =>
        group.items.flatMap((item) => [item, ...(item.children ?? [])]),
      ),
    [visibleGroups],
  );
  const activeGroupLabels = useMemo(
    () =>
      visibleGroups
        .filter((group) => group.items.some((item) => itemOrChildMatchesPath(item, pathname)))
        .map((group) => group.label),
    [pathname, visibleGroups],
  );
  const activeGroupLabelsKey = activeGroupLabels.join("|");
  const activeParentItemLabels = useMemo(
    () =>
      visibleGroups.flatMap((group) =>
        group.items
          .filter(
            (item) =>
              (item.children?.length ?? 0) > 0 &&
              (itemMatchesPath(item, pathname) ||
                (item.children?.some((child) => itemMatchesPath(child, pathname)) ?? false)),
          )
          .map((item) => item.label),
      ),
    [pathname, visibleGroups],
  );
  const activeParentItemLabelsKey = activeParentItemLabels.join("|");
  // Default to every group expanded so the full module set is discoverable on
  // first load. Once hydrated, the user's persisted collapse choices take over.
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () =>
      new Set([
        ...visibleGroups.map((group) => group.label),
        ...activeGroupLabels,
        ...activeParentItemLabels,
      ]),
  );
  const [hasHydrated, setHasHydrated] = useState(false);

  // Restore the user's saved expand/collapse state once on mount, always
  // keeping the active route's group open so navigation never hides the
  // current page. Runs mount-only; active labels are read from first render.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(NAV_OPEN_GROUPS_STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const restored = parsed.filter((value): value is string => typeof value === "string");
          setOpenGroups(
            () => new Set([...restored, ...activeGroupLabels, ...activeParentItemLabels]),
          );
        }
      }
    } catch {
      // Ignore malformed or unavailable storage and keep the default state.
    }

    setHasHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist changes after hydration so we never overwrite saved state with the
  // pre-hydration default.
  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    try {
      window.localStorage.setItem(NAV_OPEN_GROUPS_STORAGE_KEY, JSON.stringify([...openGroups]));
    } catch {
      // Ignore unavailable storage (e.g. privacy mode).
    }
  }, [hasHydrated, openGroups]);

  useEffect(() => {
    if (!activeGroupLabelsKey) {
      return;
    }

    setOpenGroups((current) => {
      const next = new Set(current);
      activeGroupLabelsKey.split("|").forEach((label) => next.add(label));
      return next;
    });
    // Depend on a stable key so user-collapsed active groups do not reopen on every render.
  }, [activeGroupLabelsKey]);

  useEffect(() => {
    if (!activeParentItemLabelsKey) {
      return;
    }

    setOpenGroups((current) => {
      const next = new Set(current);
      activeParentItemLabelsKey.split("|").forEach((label) => next.add(label));
      return next;
    });
  }, [activeParentItemLabelsKey]);

  return (
    <div
      className={cn(
        "scrollbar-hidden flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto",
        collapsed ? "items-center px-2" : "pr-1",
      )}
    >
      {visibleGroups.map((group) => {
        const isOpen = openGroups.has(group.label);

        return (
          <section className={cn("grid gap-1", collapsed ? "w-full" : "")} key={group.label}>
            <button
              aria-expanded={isOpen}
              className={cn(
                "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[0.66rem] font-semibold uppercase tracking-[0.2em] transition-colors",
                isPosTheme
                  ? "text-zinc-500 hover:bg-zinc-200 hover:text-zinc-950"
                  : "text-workspace-sidebar-muted hover:bg-white/[0.06] hover:text-white",
                collapsed ? "justify-center px-2" : "",
              )}
              onClick={() => {
                setOpenGroups((current) => {
                  const next = new Set(current);

                  if (next.has(group.label)) {
                    next.delete(group.label);
                  } else {
                    next.add(group.label);
                  }

                  return next;
                });
              }}
              type="button"
            >
              {collapsed ? (
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    isPosTheme ? "bg-zinc-500" : "bg-workspace-sidebar-muted",
                  )}
                />
              ) : (
                <>
                  <span>{group.label}</span>
                  <ChevronDown
                    className={cn("h-3.5 w-3.5 transition-transform", isOpen ? "rotate-180" : "")}
                  />
                </>
              )}
            </button>

            {isOpen ? (
              <div className="grid gap-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const hasChildren = (item.children?.length ?? 0) > 0;
                  const isActive = isCurrentItem(item, pathname, visibleItems);
                  const isParentActive =
                    hasChildren &&
                    (itemMatchesPath(item, pathname) ||
                      (item.children?.some((child) => itemMatchesPath(child, pathname)) ?? false));

                  if (hasChildren) {
                    const isItemOpen = openGroups.has(item.label);
                    return (
                      <div className="grid gap-1" key={item.href}>
                        <NavigationTooltip collapsed={collapsed} label={item.label}>
                          <button
                            aria-expanded={isItemOpen}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                              isPosTheme
                                ? isParentActive
                                  ? "bg-zinc-950 text-white shadow-none"
                                  : "text-zinc-700 hover:bg-zinc-200 hover:text-zinc-950"
                                : isParentActive
                                  ? "bg-workspace-sidebar-active text-white shadow-sm"
                                  : "text-white/78 hover:bg-white/[0.07] hover:text-white",
                              collapsed ? "justify-center px-2.5" : "",
                            )}
                            onClick={() => {
                              setOpenGroups((current) => {
                                const next = new Set(current);

                                if (next.has(item.label)) {
                                  next.delete(item.label);
                                } else {
                                  next.add(item.label);
                                }

                                return next;
                              });
                            }}
                            type="button"
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            {!collapsed ? (
                              <>
                                <span className="min-w-0 flex-1 truncate text-left">
                                  {item.label}
                                </span>
                                <ChevronDown
                                  className={cn(
                                    "h-4 w-4 transition-transform",
                                    isItemOpen ? "rotate-180" : "",
                                  )}
                                />
                              </>
                            ) : null}
                          </button>
                        </NavigationTooltip>

                        {isItemOpen && !collapsed ? (
                          <div
                            className={cn(
                              "ml-4 grid gap-1 border-l pl-3",
                              isPosTheme ? "border-zinc-300" : "border-white/10",
                            )}
                          >
                            {item.children?.map((child) => {
                              const ChildIcon = child.icon;
                              const childIsActive = isCurrentItem(child, pathname, visibleItems);

                              return (
                                <Link
                                  className={cn(
                                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                                    isPosTheme
                                      ? childIsActive
                                        ? "bg-zinc-950 text-white shadow-none"
                                        : "text-zinc-600 hover:bg-zinc-200 hover:text-zinc-950"
                                      : childIsActive
                                        ? "bg-white text-workspace-sidebar shadow-sm"
                                        : "text-white/65 hover:bg-white/[0.07] hover:text-white",
                                  )}
                                  href={child.href}
                                  key={child.href}
                                  {...(onNavigate ? { onClick: onNavigate } : {})}
                                >
                                  <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">{child.label}</span>
                                </Link>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  }

                  return (
                    <NavigationTooltip collapsed={collapsed} key={item.href} label={item.label}>
                      <Link
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                          isPosTheme
                            ? isActive
                              ? "bg-zinc-950 text-white shadow-none"
                              : "text-zinc-700 hover:bg-zinc-200 hover:text-zinc-950"
                            : isActive
                              ? "bg-workspace-sidebar-active text-white shadow-sm"
                              : "text-white/78 hover:bg-white/[0.07] hover:text-white",
                          collapsed ? "justify-center px-2.5" : "",
                        )}
                        href={item.href}
                        {...(onNavigate ? { onClick: onNavigate } : {})}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {!collapsed ? <span className="truncate">{item.label}</span> : null}
                      </Link>
                    </NavigationTooltip>
                  );
                })}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
