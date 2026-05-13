# Dokploy Production Deployment

Deploy three services in this order:

1. `DMD_Pastries_Postgres`
2. `DMD_Pastries_backend`
3. `DMD_Pastries_frontend`

Use separate public domains:

```txt
Backend API:  https://api.<your-domain>
Frontend App: https://app.<your-domain>
```

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
Root directory: frondend
Build type: Dockerfile
Dockerfile path: Dockerfile
Container port: 3000
Public domain: https://app.<your-domain>
```

Copy values from:

```txt
frondend/.env.production.example
```

Set the same `NEXT_PUBLIC_*` values in Dokploy runtime environment and Docker build arguments. These values are baked into the Next.js production build:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.<your-domain>
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://<your-domain>.com/v1
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
- Appwrite file previews/uploads work.
