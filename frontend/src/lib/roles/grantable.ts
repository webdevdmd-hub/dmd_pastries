/**
 * A role can be given only by someone who already holds every permission in
 * it (owner decision 2026-09-17, ISSUE-056). The server enforces this; the
 * pickers use the same rule so they do not offer a role the server refuses.
 */
export function isRoleGrantable(
  rolePermissionKeys: readonly string[],
  heldPermissions: readonly string[],
): boolean {
  const held = new Set(heldPermissions);
  return rolePermissionKeys.every((key) => held.has(key));
}

/**
 * Why the current user cannot change a role's permissions, or null when they
 * can. Mirrors the server: never your own role, and never a role that already
 * holds permissions you lack (ISSUE-056).
 */
export function rolePermissionChangeBlockedReason(
  role: { permissionKeys: readonly string[]; roleName: string },
  currentUser: { permissions: readonly string[]; roles: readonly string[] },
): string | null {
  if (currentUser.roles.some((name) => name.toLowerCase() === role.roleName.toLowerCase())) {
    return "You can't change the permissions of your own role. Ask another admin.";
  }
  if (!isRoleGrantable(role.permissionKeys, currentUser.permissions)) {
    return "This role includes permissions you don't have, so you can't change it.";
  }
  return null;
}
