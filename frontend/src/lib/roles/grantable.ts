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
