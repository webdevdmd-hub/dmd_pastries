"use client";

import { PERMISSIONS } from "@/constants/permissions";
import { useAuth } from "@/hooks/use-auth";
import { useBusinessProfile } from "@/hooks/use-business";
import { usePermission } from "@/hooks/use-permission";

/**
 * The tenant name to show in workspace chrome (header, sidebars).
 *
 * Single source on purpose: the header and the two sidebars each resolving this
 * themselves is how the sidebar ended up showing a hardcoded brand, and then a
 * generic fallback, while the header showed the real tenant.
 *
 * The business profile is gated behind settings.view, so roles without it fall
 * back to the profile name and finally to a neutral label. useBusinessProfile
 * shares its query key with the header, so this costs no extra request.
 */
export function useWorkspaceName(): string {
  const { user } = useAuth();
  const { hasPermission } = usePermission();
  const businessQuery = useBusinessProfile(hasPermission(PERMISSIONS.settingsView));

  return businessQuery.data?.businessName ?? user?.businessName ?? "Business workspace";
}
