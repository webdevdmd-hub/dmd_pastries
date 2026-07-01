import { ROUTES } from "@/constants/routes";
import type { SafeUserProfile } from "@/types/user";

export function authenticatedHomeRoute(profile: SafeUserProfile): string {
  return profile.isPlatformAdmin ? ROUTES.superAdmin : ROUTES.dashboard;
}
