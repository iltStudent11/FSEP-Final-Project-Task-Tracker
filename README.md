# FSEP Final Project Task Tracker

A Project Task Tracker — a line-of-business application for teams to manage projects, tasks, and delivery progress.

<!-- PAGES-LINK:START -->
📖 **Documentation site** — architecture & design docs, published from `docs/` via GitHub Pages.
<!-- PAGES-LINK:END -->

## Project layout

```text
.
├── backend-api/               # Express + MongoDB API
├── frontend-client/react-ts/  # React + TypeScript client (Vite)
├── docs/                      # Architecture and design documentation
├── docker-compose.yml         # Dev: run everything in containers over plain HTTP
├── docker-compose.prod.yml    # Prod-like: adds HTTPS via a self-signed cert
├── k8s/                       # Optional: Kubernetes manifests for the same stack
└── README.md
```

The backend and frontend are separate npm projects with their own `package.json` and commands, run from their respective directories. Everything in the **Setup**/**npm scripts**/**API overview**/**Testing** sections below is for `backend-api/`; see [**Frontend**](#frontend) for the client. If you'd rather not install Node/MongoDB locally, see [**Running with Docker**](#running-with-docker) (or [**Running on Kubernetes**](#running-on-kubernetes)) to run the whole stack in containers instead.

## Tech stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Express 5
- **Database:** MongoDB via Mongoose
- **Auth:** JWT (`jsonwebtoken`) + bcrypt password hashing (`bcryptjs`)
- **Validation:** `express-validator`
- **Testing:** Vitest

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how the pieces fit together and [`docs/DESIGN.md`](docs/DESIGN.md) for data model and API design decisions.

## Prerequisites

- Node.js 20+
- A running MongoDB instance (e.g. via Docker: `docker run -d -p 27017:27017 mongo:7`)

> Prefer not to install Node/MongoDB at all? Skip straight to [**Running with Docker**](#running-with-docker) to run the whole stack (Mongo + API + client) in containers.

> Once both projects' dependencies are installed and `backend-api/.env` is set up (steps 1-2 below), `make dev` runs the backend and frontend dev servers together from the repo root, and `make dev-seed` resets/reseeds the database first. See the [`Makefile`](Makefile) for the full list of targets.

## Setup

1. Move into the app directory and install dependencies:

   ```bash
   cd backend-api
   npm install
   ```

2. Copy the environment template and fill in the values:

   ```bash
   cp .env_example .env
   ```

   | Variable       | Description                                                                |
   | -------------- | --------------------------------------------------------------------------- |
   | `PORT`         | Port the API server listens on (defaults to 5000 if unset)                |
   | `MONGODB_URI`  | MongoDB connection string, e.g. `mongodb://127.0.0.1:27017/policy-claims` |
   | `JWT_SECRET`   | Secret used to sign and verify JWTs                                        |

3. (Optional) Seed the database with sample users, policies, and claims:

   ```bash
   npm run seed
   ```

   (or, from the repo root: `make seed`)

   This clears existing `User`/`Policy`/`Claim` data and inserts:
   - 3 users — 1 admin (`admin@policyclaims.com`), 2 adjusters (`alice@policyclaims.com`, `bob@policyclaims.com`), password `Admin123!` / `Password123!` respectively
   - 5 policies across auto/home/life types and active/expired/cancelled statuses
   - 6 claims spread across every status, several with notes

   ```mermaid
   pie showData title Seeded claims by status
       "submitted" : 2
       "under-review" : 1
       "approved" : 1
       "denied" : 1
       "closed" : 1
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

   (or, from the repo root: `make dev` to also start the frontend dev server alongside it, or `make dev-seed` to reseed the database first)

## npm scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the server with hot reload (`tsx watch`) |
| `npm run build` | Type-check and compile to `dist/` |
| `npm start` | Run the compiled server from `dist/server.js` |
| `npm run typecheck` | Type-check without emitting output |
| `npm test` | Run the Vitest suite |
| `npm run seed` | Reset and repopulate the database with sample data |

## API overview

All routes are mounted under `/api`. Every route except `/api/health` and `/api/auth/register`/`/login` requires a `Authorization: Bearer <token>` header.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Server + database connectivity check |
| POST | `/api/auth/register` | Create a user account (does not return a token — log in separately) |
| POST | `/api/auth/login` | Authenticate, returns a JWT and its expiry timestamp |
| GET | `/api/auth/me` | Return the authenticated user's profile |
| GET | `/api/policies` | List policies (filter by `type`, `status`, `search`; paginated) |
| GET | `/api/policies/:id` | Get a single policy (owner populated) |
| POST | `/api/policies` | Create a policy |
| PUT | `/api/policies/:id` | Update a policy |
| DELETE | `/api/policies/:id` | Delete a policy |
| GET | `/api/claims` | List claims (filter by `status`, `policy`, `assignedTo`, `search`; paginated) |
| GET | `/api/claims/stats` | Aggregated claim statistics |
| GET | `/api/claims/:id` | Get a single claim (policy + assignee populated) |
| POST | `/api/claims` | Create a claim (auto-assigned to the requesting user) |
| PUT | `/api/claims/:id` | Update a claim |
| POST | `/api/claims/:id/notes` | Add a note to a claim |
| DELETE | `/api/claims/:id` | Delete a claim |
| GET | `/api/dashboard` | Aggregated totals across claims, policies, and users |

## Testing

```bash
npm test
```

The suite includes pure unit tests (models validation, middleware, utilities) and DB-backed tests that run against a dedicated `policy-claims-test` MongoDB database — a local MongoDB instance must be reachable to run the full suite. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#testing) for details.

## Frontend

[`frontend-client/react-ts/`](frontend-client/react-ts/) is a React + TypeScript (Vite) client for the API above. See its [README](frontend-client/react-ts/README.md) for setup, routes, and auth flow — in short:

```bash
cd frontend-client/react-ts
npm install
npm run dev
```

The dev server proxies `/api/*` requests to the backend at `http://localhost:3000` (see `vite.config.ts`), so run `backend-api`'s dev server alongside it — or just run `make dev` from the repo root to start both together. No frontend-specific environment variables are required.

## Running with Docker

The whole stack (MongoDB, API, client) can also be run in containers instead of installing Node/MongoDB locally. Two Compose files are provided; both build `backend-api/Dockerfile` and `frontend-client/Dockerfile` and start a `mongo:7` container — pick one based on whether you want plain HTTP or HTTPS.

### Option 1: `docker-compose.yml` — plain HTTP (quick dev)

```bash
docker compose up -d --build
```

| Service | URL |
|---|---|
| Client (React app) | http://localhost:4000 |
| API | http://localhost:3000 |
| MongoDB | localhost:27017 |

The client container's nginx serves the built SPA and proxies `/api/*` to the `api` service, so the app works end-to-end at `http://localhost:4000` with no other setup. Set `JWT_SECRET` in your shell environment before starting if you don't want the insecure default (`dev-secret-change-me`).

### Option 2: `docker-compose.prod.yml` — HTTPS via a self-signed cert

Closer to a real deployment: nginx terminates TLS and redirects plain HTTP to HTTPS.

1. Generate a self-signed cert (once; writes to `certs/`, which is gitignored):

   ```bash
   ./generate-certs.sh
   ```

2. Start the stack:

   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

| Service | URL |
|---|---|
| Client (HTTPS) | https://localhost:8443 |
| Client (HTTP, redirects to HTTPS) | http://localhost:8080 |
| API | not published to the host — reached by the client container only, at `api:3000` |

The cert is self-signed for `localhost`, so browsers/`curl` will warn about it being untrusted (`curl -k` to skip verification). A request that hits port `8443` over plain HTTP (e.g. a stale bookmark) is redirected to HTTPS rather than failing.

To stop either stack: `docker compose [-f docker-compose.prod.yml] down` (add `-v` to also drop the `mongo-data` volume and lose seeded data).

## Running on Kubernetes

`k8s/` has manifests for the same stack — MongoDB, API, client — as an alternative to either Compose file, for exercising the app in a real cluster (e.g. Docker Desktop's built-in Kubernetes). All resources live in a dedicated `policy-claims` namespace.

| File | Creates |
|---|---|
| `k8s/namespace.yaml` | The `policy-claims` namespace |
| `k8s/secrets.yaml` | Template for the `policy-claims-secrets` Secret (`PORT`, `NODE_ENV`, `JWT_SECRET`, `MONGODB_URI`) — placeholders only, see below |
| `k8s/mongo.yaml` | `mongo:7` Deployment (1 replica) + a 1Gi `ReadWriteOnce` PVC mounted at `/data/db` + a ClusterIP Service on 27017 |
| `k8s/api.yaml` | API Deployment (2 replicas), env loaded from the Secret, readiness/liveness probes on `GET /api/health`, ClusterIP Service on 3000 |
| `k8s/client.yaml` | Client Deployment (1 replica), NodePort Service exposing port 80 as `30080` |

**1. Build the images locally** — the Deployments use `imagePullPolicy: Never`, so nothing is pulled from a registry; Kubernetes must find the image already present on the node (works as-is on Docker Desktop, since its cluster shares the host's Docker image store):

```bash
docker build -t p3-capstone-api:latest ./backend-api
docker build -t p3-capstone-client:latest ./frontend-client
```

**2. Create the namespace, then the Secret** — `k8s/secrets.yaml` is a template with placeholder values only (safe to commit); populate the real Secret imperatively instead of editing it with live values:

```bash
kubectl apply -f k8s/namespace.yaml

kubectl create secret generic policy-claims-secrets \
  --namespace policy-claims \
  --from-literal=PORT=3000 \
  --from-literal=NODE_ENV=production \
  --from-literal=JWT_SECRET="$(grep -oP '(?<=^JWT_SECRET=).*' backend-api/.env | tr -d '"')" \
  --from-literal=MONGODB_URI="mongodb://mongo.policy-claims.svc.cluster.local:27017/policy-claims" \
  --dry-run=client -o yaml | kubectl apply -f -
```

**3. Apply the rest:**

```bash
kubectl apply -f k8s/mongo.yaml
kubectl apply -f k8s/api.yaml
kubectl apply -f k8s/client.yaml
```

**4. Access the app** at `http://localhost:30080` (Docker Desktop maps NodePort services to `localhost` automatically). To reach MongoDB directly (e.g. from Compass), it's ClusterIP-only, so tunnel it first: `kubectl port-forward svc/mongo -n policy-claims 27017:27017`, then connect to `mongodb://localhost:27017`.

If you change the Secret after `api`/`client` are already running, env vars are only injected at container start — re-apply the secret, then `kubectl rollout restart deployment/api -n policy-claims` (and/or `client`) to pick it up.

To tear everything down: `kubectl delete namespace policy-claims` — this deletes the Deployments, Services, the Secret, **and** the `mongo-data` PVC (and its backing volume, since Docker Desktop's default StorageClass reclaim policy is `Delete`), so any seeded data is lost with it.
