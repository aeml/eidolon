ARG GO_VERSION=1.27.1
FROM golang:${GO_VERSION}-alpine AS builder

WORKDIR /src

RUN apk add --no-cache ca-certificates tzdata

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Release identity changes on every deployment. Keep it out of dependency-layer
# cache keys, while still relinking the executable with the exact release values.
ARG BUILD_COMMIT=development
ARG BUILD_VERSION="Alpha 1.79.4"

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath \
    -ldflags="-s -w -X 'main.buildCommit=${BUILD_COMMIT}' -X 'main.buildVersion=${BUILD_VERSION}'" \
    -o /out/eidolon-server .

FROM builder AS monitor-builder
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath \
    -ldflags="-s -w" -o /out/eidolon-monitor ./cmd/monitor

FROM gcr.io/distroless/base-debian12:nonroot AS monitor
WORKDIR /app
COPY --from=monitor-builder /out/eidolon-monitor /app/eidolon-monitor
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
ENTRYPOINT ["/app/eidolon-monitor"]

FROM gcr.io/distroless/base-debian12:nonroot AS api

WORKDIR /app

COPY --from=builder /out/eidolon-server /app/eidolon-server
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo

EXPOSE 8080

ENTRYPOINT ["/app/eidolon-server"]
