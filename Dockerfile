ARG GO_VERSION=1.26
ARG VERSION=dev

FROM node:22-alpine AS web-builder
WORKDIR /app/web

COPY web/package.json web/package-lock.json ./
RUN npm ci

COPY web/ ./
RUN npm run build

FROM golang:${GO_VERSION}-alpine AS go-builder
WORKDIR /app

RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

COPY . .

ARG VERSION
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-w -s -X main.version=${VERSION}" -o /server ./cmd/server

FROM alpine:3.22
WORKDIR /app

ENV TZ=UTC

RUN apk add --no-cache ca-certificates

COPY --from=go-builder /server /app/server
COPY config.yaml /app/config.yaml
COPY --from=web-builder /app/web/dist /app/web

EXPOSE 1780

CMD ["/app/server"]
