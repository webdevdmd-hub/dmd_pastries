/**
 * Quick actions a role may actually use: every permission the destination
 * page (and, for a "Create …" action, the create itself) requires must be
 * held. The dashboards listed their actions unconditionally, so a till-only
 * role was offered Create Customer, View Ready Orders and Add Payment, each
 * ending on "Access denied" (ISSUE-069).
 */
export function quickActionsAllowed<T extends { requires: readonly string[] }>(
  actions: readonly T[],
  hasPermission: (permission: string) => boolean,
): T[] {
  return actions.filter((action) =>
    action.requires.every((permission) => hasPermission(permission)),
  );
}
