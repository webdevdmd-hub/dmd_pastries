# Dokploy Production Deployment

Deploy three services in this order:

1. `DMD_Pastries_Postgres`
2. `DMD_Pastries_backend`
3. `DMD_Pastries_frontend`

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

## PostgreSQL Service

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
Root directory: backend
Build type: Dockerfile
Dockerfile path: Dockerfile
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
