# Backend Contracts: Admin Maturity Phase

This document defines the next backend API contracts required before the frontend can complete invitation-based staff onboarding, branch assignment, soft-delete, and activity/history views.

All endpoints are under:

```text
/api/v1
```

All protected endpoints must require an Appwrite JWT through:

```text
Authorization: Bearer <appwrite_jwt>
```

All responses should use the existing wrapper shape:

```json
{
  "success": true,
  "message": "Request completed.",
  "data": {}
}
```

Errors should use:

```json
{
  "success": false,
  "message": "Validation failed.",
  "errors": {
    "email": ["Email is already invited."]
  }
}
```

## Permissions

Recommended permission rules:

- `users.view`: list users, view user details, view user activity.
- `users.create`: invite staff.
- `users.edit`: update staff profile, assign branch, resend invite, cancel invite.
- `users.delete`: soft-delete users.
- `settings.view`: list branches in the current backend route registration.
- `settings.manage`: create/update branches in the current backend route registration.
- `branches.view` and `branches.manage` are seeded and available for future finer-grained branch access, but they are not the active route guards in `cmd/api/main.go` yet.

Backend remains the authority. Frontend permission checks are UI-only.

## Invitation-Based Staff Onboarding

### Invite Staff User

```text
POST /api/v1/users/invitations
```

Permission:

```text
users.create
```

Request:

```json
{
  "full_name": "Sarah Cashier",
  "email": "sarah@example.com",
  "phone": "+971501234567",
  "role_id": "role_cashier",
  "branch_id": "branch_main"
}
```

Response:

```json
{
  "success": true,
  "message": "Invitation sent.",
  "data": {
    "id": "invite_123",
    "business_id": "business_123",
    "branch_id": "branch_main",
    "role_id": "role_cashier",
    "full_name": "Sarah Cashier",
    "email": "sarah@example.com",
    "phone": "+971501234567",
    "status": "pending",
    "expires_at": "2026-05-05T10:00:00Z",
    "accepted_at": null,
    "created_at": "2026-04-28T10:00:00Z",
    "updated_at": "2026-04-28T10:00:00Z"
  }
}
```

Rules:

- Backend creates an invitation record.
- Backend sends invitation email or returns enough state for a mail worker to send it.
- Do not expose raw invite secrets in list responses.
- If a user already exists, return `409`.
- If an active pending invite exists for the email, return `409`.

### List Invitations

```text
GET /api/v1/users/invitations?status=pending
```

Permission:

```text
users.view
```

Response data:

```json
[
  {
    "id": "invite_123",
    "business_id": "business_123",
    "branch_id": "branch_main",
    "role_id": "role_cashier",
    "full_name": "Sarah Cashier",
    "email": "sarah@example.com",
    "phone": "+971501234567",
    "status": "pending",
    "expires_at": "2026-05-05T10:00:00Z",
    "accepted_at": null,
    "created_at": "2026-04-28T10:00:00Z",
    "updated_at": "2026-04-28T10:00:00Z"
  }
]
```

### Resend Invitation

```text
POST /api/v1/users/invitations/:id/resend
```

Permission:

```text
users.edit
```

Response data:

```json
{
  "id": "invite_123",
  "status": "pending",
  "expires_at": "2026-05-05T10:00:00Z",
  "updated_at": "2026-04-28T11:00:00Z"
}
```

### Cancel Invitation

```text
PATCH /api/v1/users/invitations/:id/cancel
```

Permission:

```text
users.edit
```

Response data:

```json
{
  "id": "invite_123",
  "status": "cancelled",
  "updated_at": "2026-04-28T11:00:00Z"
}
```

### Accept Invitation

```text
POST /api/v1/auth/accept-invitation
```

Auth:

```text
public endpoint with invite token
```

Request:

```json
{
  "token": "invite_token_from_email",
  "password": "SecurePassword123",
  "confirm_password": "SecurePassword123"
}
```

Response data:

```json
{
  "user_id": "user_123",
  "appwrite_user_id": "appwrite_123",
  "business_id": "business_123",
  "branch_id": "branch_main",
  "role_id": "role_cashier",
  "status": "active"
}
```

Rules:

- Backend validates token, expiry, and invite status.
- Backend creates or activates the Appwrite user.
- Backend creates the internal user record.
- Backend marks invitation as accepted.

## Branch Assignment

### Branch Type

```json
{
  "id": "branch_main",
  "business_id": "business_123",
  "name": "Downtown Bakery",
  "code": "DXB-001",
  "phone": "+971501234567",
  "email": "branch@example.com",
  "address_line_1": "Street 1",
  "address_line_2": "Shop 10",
  "city": "Dubai",
  "country": "UAE",
  "timezone": "Asia/Dubai",
  "status": "active",
  "created_at": "2026-04-28T10:00:00Z",
  "updated_at": "2026-04-28T10:00:00Z"
}
```

Branch statuses:

```text
active
inactive
```

### List Branches

```text
GET /api/v1/branches
```

Permission:

```text
settings.view
```

### Create Branch

```text
POST /api/v1/branches
```

Permission:

```text
settings.manage
```

Request:

```json
{
  "name": "Downtown Bakery",
  "code": "DXB-001",
  "phone": "+971501234567",
  "email": "branch@example.com",
  "address_line_1": "Street 1",
  "address_line_2": "Shop 10",
  "city": "Dubai",
  "country": "UAE",
  "timezone": "Asia/Dubai",
  "status": "active"
}
```

### Update Branch

```text
PATCH /api/v1/branches/:id
```

Permission:

```text
settings.manage
```

### Assign User Branch

```text
PATCH /api/v1/users/:id/branch
```

Permission:

```text
users.edit
```

Request:

```json
{
  "branch_id": "branch_main"
}
```

Response data should return the updated user.

## Soft-Delete Users

### Soft-Delete User

```text
DELETE /api/v1/users/:id
```

Permission:

```text
users.delete
```

Response data:

```json
{
  "id": "user_123",
  "status": "deleted",
  "deleted_at": "2026-04-28T10:00:00Z"
}
```

Rules:

- Do not hard-delete user records by default.
- Prevent owner self-delete.
- Prevent deleting the only active owner/admin for a business.
- Backend should disable or revoke Appwrite session access as appropriate.

### Restore Soft-Deleted User

```text
PATCH /api/v1/users/:id/restore
```

Permission:

```text
users.delete
```

Response data should return the restored user.

## User Activity / History

### Activity Log Type

```json
{
  "id": "activity_123",
  "business_id": "business_123",
  "actor_user_id": "user_owner",
  "target_user_id": "user_cashier",
  "event_type": "user.status_changed",
  "entity_type": "user",
  "entity_id": "user_cashier",
  "summary": "User status changed from inactive to active.",
  "metadata": {
    "from_status": "inactive",
    "to_status": "active"
  },
  "created_at": "2026-04-28T10:00:00Z"
}
```

### List Business Activity

```text
GET /api/v1/activity-logs?entity_type=user&limit=50&cursor=
```

Permission:

```text
settings.manage
```

Response data:

```json
{
  "items": [],
  "next_cursor": null
}
```

### List User Activity

```text
GET /api/v1/users/:id/activity
```

Permission:

```text
users.view
```

Response data:

```json
{
  "items": [],
  "next_cursor": null
}
```

Recommended event types:

- `auth.login`
- `auth.logout`
- `user.invited`
- `user.invitation_accepted`
- `user.invitation_cancelled`
- `user.invitation_resent`
- `user.created`
- `user.updated`
- `user.status_changed`
- `user.branch_assigned`
- `user.soft_deleted`
- `user.restored`
- `role.created`
- `role.updated`
- `role.permissions_updated`
- `settings.updated`

## Frontend Dependency Notes

Once these contracts exist, the frontend can safely implement:

- Staff invitation dialog instead of raw password user creation.
- Branch dropdown backed by `GET /api/v1/branches`.
- Delete/restore user actions with self-lockout protection.
- User detail drawer with activity history.
- Audit log page with real backend events.
