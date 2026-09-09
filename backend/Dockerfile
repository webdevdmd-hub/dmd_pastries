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

FROM alpine:3.22

# Alpine ships no trust store, so every TLS verification fails on an image
# without this -- including sslmode=verify-full against a managed Postgres,
# which is the whole point of setting it. Without the certificates the failure
# is a connection refused at boot with an x509 message, and the tempting fix is
# to drop back to sslmode=require, which silently gives up verification.
RUN apk add --no-cache ca-certificates

RUN adduser -D -g '' appuser
WORKDIR /app

COPY --from=builder /bin/api /app/api
COPY --from=builder /bin/migrate /app/migrate
COPY backend/migrations /app/migrations

EXPOSE 8080

USER appuser

CMD ["/bin/sh", "-c", "/app/migrate && /app/api"]
