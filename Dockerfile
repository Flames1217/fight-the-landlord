ARG GO_VERSION=1.26
ARG VERSION=dev

FROM node:22-alpine AS web-builder
WORKDIR /app/web

COPY web/package.json web/package-lock.json ./
RUN npm ci

COPY web/ ./
RUN npm run build

FROM dhi.io/golang:${GO_VERSION}-dev AS go-builder
USER root
WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

ARG VERSION
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-w -s -X main.version=${VERSION}" -o /server ./cmd/server

FROM dhi.io/static:20260413-alpine3.23
WORKDIR /app

ENV TZ=UTC

COPY --from=go-builder /server /app/server
COPY config.yaml /app/config.yaml
COPY --from=web-builder /app/web/dist /app/web

EXPOSE 1780

CMD ["/app/server"]
