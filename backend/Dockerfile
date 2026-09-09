# Build context is the REPOSITORY ROOT, not backend/.
#
# Dokploy clones the repo and builds this file with the repo root as context,
# so every path here is repo-relative. Paths relative to backend/ fail the
# build with "/go.mod: not found" -- the context has backend/go.mod, and no
# /go.mod. Keep the backend/ prefixes, and build locally the same way:
#
#     docker build -f backend/Dockerfile .
#
# The root .dockerignore keeps .git and the frontend out of this context.

FROM golang:1.26-alpine AS builder

WORKDIR /app

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/api ./cmd/api
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/migrate ./cmd/migrate
# Shipped so the Appwrite -> Supabase identity import can be run where the
# database actually is. Production Postgres has no public exposure, so this
# cannot run from a laptop, and the host has no Go toolchain -- without it in
# the image the only options at cutover are exposing the database or installing
# Go on the server, both decided under time pressure. It is never invoked
# automatically; see the run instructions below.
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/import-identities ./cmd/import-identities

FROM alpine:3.22

RUN adduser -D -g '' appuser
WORKDIR /app

COPY --from=builder /bin/api /app/api
COPY --from=builder /bin/migrate /app/migrate
COPY --from=builder /bin/import-identities /app/import-identities
COPY backend/migrations /app/migrations

EXPOSE 8080

USER appuser

# The identity import is run by hand, from the host, against the running
# container. It reads an Appwrite users export and is a dry run unless -confirm
# is passed:
#
#     docker cp users.json <container>:/tmp/users.json
#     docker exec <container> /app/import-identities -export /tmp/users.json
#     docker exec <container> /app/import-identities -export /tmp/users.json -confirm
#
# It inherits the container's environment, so it already has the database and
# Supabase credentials. Deliberately absent from CMD: an import that ran on
# every container start would re-run itself on an unrelated restart, mid-shift,
# with nobody watching.
CMD ["/bin/sh", "-c", "/app/migrate && /app/api"]
