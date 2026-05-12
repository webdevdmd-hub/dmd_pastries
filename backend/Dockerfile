FROM golang:1.26-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/api ./cmd/api
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/migrate ./cmd/migrate

FROM alpine:3.22

RUN adduser -D -g '' appuser
WORKDIR /app

COPY --from=builder /bin/api /app/api
COPY --from=builder /bin/migrate /app/migrate
COPY migrations /app/migrations
COPY .env.example /app/.env.example

EXPOSE 8080

USER appuser

CMD ["/bin/sh", "-c", "/app/migrate && /app/api"]
