ARG GO_VERSION=1.24.5
FROM golang:${GO_VERSION}-alpine AS builder

ARG BUILD_COMMIT=development
ARG BUILD_VERSION="Alpha 1.0.9"

WORKDIR /src

RUN apk add --no-cache ca-certificates tzdata

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath \
    -ldflags="-s -w -X 'main.buildCommit=${BUILD_COMMIT}' -X 'main.buildVersion=${BUILD_VERSION}'" \
    -o /out/eidolon-server .

FROM gcr.io/distroless/base-debian12:nonroot

WORKDIR /app

COPY --from=builder /out/eidolon-server /app/eidolon-server
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo

EXPOSE 8080

ENTRYPOINT ["/app/eidolon-server"]
