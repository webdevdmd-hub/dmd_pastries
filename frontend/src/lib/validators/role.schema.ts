import { z } from "zod";

export const createRoleSchema = z.object({
  roleName: z.string().trim().min(2, "Role name must be at least 2 characters."),
  description: z.string().trim().optional(),
  permissions: z.array(z.string()).min(1, "Please select at least one permission."),
});

export const updateRoleSchema = z.object({
  roleName: z.string().trim().min(2, "Role name must be at least 2 characters."),
  description: z.string().trim().optional(),
  status: z.enum(["active", "inactive"]),
});

export type CreateRoleSchema = z.infer<typeof createRoleSchema>;
export type UpdateRoleSchema = z.infer<typeof updateRoleSchema>;
