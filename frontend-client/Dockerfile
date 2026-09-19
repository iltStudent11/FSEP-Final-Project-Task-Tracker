# syntax=docker/dockerfile:1
#
# Build context is this directory (frontend-client/); the actual Vite app
# lives in the react-ts/ subdirectory.

# ---------------------------------------------------------------------------
# Stage 1: builder — install dependencies and produce the Vite production
# build (react-ts/dist)
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

COPY react-ts/package.json react-ts/package-lock.json ./
RUN npm ci

COPY react-ts/ ./
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: runtime — static build served by nginx
# ---------------------------------------------------------------------------
FROM nginx:alpine AS runtime

COPY --from=builder /app/dist /usr/share/nginx/html

# Deployed as a template (not straight into conf.d) so the base image's
# entrypoint can substitute ${NGINX_LOCAL_RESOLVERS} — see the comment above
# the `resolver` directive in nginx.conf for why.
COPY nginx.conf /etc/nginx/templates/default.conf.template
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
# Docker Compose service name; override to the Kubernetes Service's FQDN
# (api.<namespace>.svc.cluster.local:3000) when deploying there.
ENV API_UPSTREAM=api:3000

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
