# Dokploy Production Deployment

Deploy two services in this order (the database is Supabase, not a Dokploy
service, since 10 September 2026):

1. `DMD_Pastries_backend`
2. `DMD_Pastries_frontend`

Use separate public domains, all under one registrable domain:

```txt
Backend API:  https://api.<your-domain>
Frontend App: https://app.<your-domain>
Appwrite:     https://appwrite.<your-domain>
```

The Appwrite endpoint has to sit under the same registrable domain as the
frontend. Appwrite authenticates with a session cookie, and a browser only sends
that cookie if the endpoint is first-party to the page. Put Appwrite on an
unrelated domain and the cookie is third-party, the browser drops it, and the
SDK falls back to keeping the session in `localStorage` — which any XSS on the
page can read, where an httpOnly cookie cannot. The SDK says so in the console:

> Appwrite is using localStorage for session management. Increase your security
> by adding a custom domain as your API endpoint.

Seeing that on `localhost` in development is expected and not worth chasing:
`localhost` cannot share a registrable domain with any real endpoint, so the
fallback is the only option there. Seeing it in production means the domains are
wrong.

## Supabase Project (current stack, since 10 September 2026)

Production runs on one Supabase project for Postgres, Auth and Storage. The
Dokploy Postgres and Appwrite sections further down describe the previous
stack and are kept only until Appwrite is decommissioned; do not create those
services for a new deployment.

Create the project in the region closest to the Dokploy server (the current
one is `ap-south-1`, Mumbai, same city as the server). Verify the region from
the pooler host, not from the dashboard label: `aws-0-<region>.pooler.supabase.com`
answers a wrong password with `password authentication failed`; any other
region's pooler answers `tenant or user not found`.

### Dashboard settings

Every one of these was needed; each is a setting, not code, so it has to be
repeated on any new project.

| Where | Setting | Value | Why |
| --- | --- | --- | --- |
| Authentication → Sign In / Providers | Allow new users to sign up | **off** | Accounts are created only through the app (owner registration and invitations use the admin API, which ignores this switch). |
| Authentication → Sessions | Access token (JWT) expiry time | **900** | Tokens are verified locally, so a disabled employee keeps access until the token expires. 15 minutes bounds that; the session still refreshes itself silently. |
| Authentication → URL Configuration | Site URL | `https://app.<your-domain>` | Where Supabase sends anyone it redirects. The default `localhost:3000` lands users on nothing. |
| Authentication → URL Configuration | Redirect URLs | `https://app.<your-domain>/**` | Without this, `redirect_to` on reset links is ignored and the Site URL is used instead. |
| Authentication → Emails → SMTP Settings | Custom SMTP | your provider | The built-in mailer sends about two messages an hour and, on the free tier, will not let the reset email template be edited. Custom SMTP unlocks the template; set the recovery link to `{{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}&type=recovery`. Until then the app's manager-issued reset link is the working path. |
| Settings → Data API | Exposed schemas | remove `public` | The frontend never queries the database directly. Belt and braces over RLS. |
| Storage → Policies | three INSERT policies for `authenticated` | `bucket_id = '<bucket>'` | One each for `product-images`, `business-assets`, `documents`. Browser uploads 403 without them. Dashboard only: `storage.objects` is owned by the storage admin, so SQL as `postgres` cannot create them. |

Buckets: `product-images` and `business-assets` public, `documents` private
(expense receipts; nothing renders one). Create them in the dashboard or with
`insert into storage.buckets (id, name, public) values (...)`.

Run once in the SQL Editor after the first backend boot has created the
tables:

```sql
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke usage on schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
```

The project's `ensure_rls` event trigger already enables RLS on every table
the migrations create, with no policies, which is what keeps the `anon` key
out at the database. Two things must stay true or the app itself is locked
out silently: every table stays owned by `postgres`, and no table ever gets
`FORCE ROW LEVEL SECURITY`.

### Backend environment

```env
POSTGRES_HOST=aws-0-<region>.pooler.supabase.com
POSTGRES_PORT=5432
POSTGRES_USER=postgres.<project-ref>
POSTGRES_PASSWORD=<database password>
POSTGRES_DB=postgres
POSTGRES_SSLMODE=verify-full
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>
AUTH_PRIMARY_PROVIDER=supabase
PASSWORD_RESET_URL=https://app.<your-domain>/reset-password
```

Use the session pooler, not `db.<ref>.supabase.co`: the direct host has only
an IPv6 address and does not even resolve from inside a Docker network.
`verify-full` needs no certificate setting; Supabase's root CA ships in the
image and is applied for any Supabase host. `SUPABASE_JWT_SECRET` stays unset;
user tokens are verified against the project's published key. Both the legacy
`eyJ…` service_role key and a new-style `sb_secret_…` key work unchanged.
Leave the three `APPWRITE_*` variables out entirely.

### Frontend environment

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon or sb_publishable_ key>
NEXT_PUBLIC_AUTH_PROVIDER=supabase
NEXT_PUBLIC_STORAGE_PROVIDER=supabase
```

Remove the five `NEXT_PUBLIC_APPWRITE_*` variables.

### Dokploy traps that cost a day

- The swarm service keeps the environment it was **created** with. After
  changing a variable, a plain Deploy rebuilds the image but the new container
  still gets the old values. Use **Stop** then **Deploy** (or the API's
  `application.stop` followed by `application.deploy`).
- The Environment page does nothing until its Save button is clicked; the
  orange "(You have unsaved changes)" is easy to miss. The same is true of
  Supabase's URL Configuration page.
- The backend build needs Dockerfile path `backend/Dockerfile`, context path
  `.` and build path `/`. Any other combination fails in seconds with
  `COPY backend/...: not found`.
- Dokploy builds one service at a time. After a push, the second service's
  build starts only when the first finishes; a frontend that has a new button
  before the backend has its route shows a 404 for those minutes.
- The API keeps one Server-Sent Events stream open per signed-in tab
  (`/api/v1/events/stream`) for live updates. Traefik streams it without
  configuration; if a future proxy buffers, the Network tab shows the request
  completing every 25 s instead of staying pending.

## PostgreSQL Service (superseded)

> Not used since 10 September 2026. Postgres is Supabase; see the section above.


Create the Dokploy PostgreSQL service with:

```txt
Database: pastries_pos
User: postgres
Password: generate a new strong Dokploy secret
Public exposure: disabled unless you explicitly need remote DB access
```

The backend connects internally using the service hostname:

```txt
DMD_Pastries_Postgres
```

## Backend Service

Dokploy service settings:

```txt
Service name: DMD_Pastries_backend
Build type: Dockerfile
Dockerfile path: backend/Dockerfile
Docker context path: .
Build path: /
Container port: 8080
Health check path: /health
Public domain: https://api.<your-domain>
```

Copy values from:

```txt
backend/.env.production.example
```

Set real secrets in Dokploy, not in Git:

```env
# Superseded: see "Supabase Project" above for the current variables.
POSTGRES_PASSWORD=<DOKPLOY_POSTGRES_PASSWORD>
DATABASE_URL=postgresql://postgres:<DOKPLOY_POSTGRES_PASSWORD>@DMD_Pastries_Postgres:5432/pastries_pos?sslmode=disable
APPWRITE_API_KEY=<APPWRITE_SERVER_API_KEY>
PASSWORD_RESET_URL=https://app.<your-domain>/reset-password
```

The backend Dockerfile runs migrations before starting the API:

```sh
/app/migrate && /app/api
```

## Frontend Service

Dokploy service settings:

```txt
Service name: DMD_Pastries_frontend
Root directory: frontend
Build type: Dockerfile
Dockerfile path: Dockerfile
Container port: 3000
Public domain: https://app.<your-domain>
```

Preferred production mode is the frontend Dockerfile. It builds Next.js with `output: "standalone"` and starts the generated server with:

```txt
node server.js
```

If you use a custom Node/Nixpacks-style Dokploy start command instead of the Dockerfile, run:

```txt
pnpm start
```

The frontend `start` script runs:

```txt
node .next/standalone/server.js
```

Do not run `next start` for this app in production because standalone output is enabled.

Copy values from:

```txt
frontend/.env.production.example
```

Set the same `NEXT_PUBLIC_*` values in Dokploy runtime environment and Docker build arguments. These values are baked into the Next.js production build:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.<your-domain>
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://appwrite.<your-domain>/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=
NEXT_PUBLIC_APPWRITE_PRODUCT_IMAGES_BUCKET_ID=
NEXT_PUBLIC_APPWRITE_BUSINESS_ASSETS_BUCKET_ID=
NEXT_PUBLIC_APPWRITE_USER_AVATARS_BUCKET_ID=
NEXT_PUBLIC_APPWRITE_DOCUMENTS_BUCKET_ID=
```

Do not use `localhost` in production.

## Verification

After deploy:

```txt
GET https://api.<your-domain>/health
```

Then verify:

- Backend logs show migrations completed.
- Frontend API requests go to `https://api.<your-domain>`.
- Owner registration and login work.
- `GET /api/v1/auth/me` returns business and branch context.
- Dashboard and settings APIs do not return 404.
- The browser console shows no Appwrite `localStorage` warning, and `localStorage`
  has no `cookieFallback` key. Either one means the Appwrite endpoint is not
  first-party to the frontend and sessions are being kept where an XSS can read
  them.
- Appwrite file previews/uploads work.
