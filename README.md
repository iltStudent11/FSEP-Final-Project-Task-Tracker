# FSEP Final Project Task Tracker

A Project Task Tracker — a line-of-business application for teams to manage projects, tasks, and delivery progress.

[![CI](https://github.com/iltStudent11/FSEP-Final-Project-Task-Tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/iltStudent11/FSEP-Final-Project-Task-Tracker/actions/workflows/ci.yml)
[![Docs](https://github.com/iltStudent11/FSEP-Final-Project-Task-Tracker/actions/workflows/pages.yml/badge.svg)](https://github.com/iltStudent11/FSEP-Final-Project-Task-Tracker/actions/workflows/pages.yml)
[![Actions](https://img.shields.io/badge/Actions-Dashboard-2088FF?logo=githubactions&logoColor=white)](https://github.com/iltStudent11/FSEP-Final-Project-Task-Tracker/actions)

## Build Status

- **CI**: Runs backend type-checking and tests (including integration tests) plus frontend lint, build, and test checks on pushes and pull requests. [View run history](https://github.com/iltStudent11/FSEP-Final-Project-Task-Tracker/actions/workflows/ci.yml).
- **Docs**: Builds and deploys documentation from `docs/` to GitHub Pages when docs-related changes are pushed to `main`. [View run history](https://github.com/iltStudent11/FSEP-Final-Project-Task-Tracker/actions/workflows/pages.yml).

<!-- PAGES-LINK:START -->
📖 **[Documentation site](https://iltstudent11.github.io/FSEP-Final-Project-Task-Tracker/)** — architecture & design docs, published from `docs/` via GitHub Pages.
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

- Node.js 22+ (CI and both projects' test suites run on Node 22; Node 20 hits a known `jsdom`/`undici` incompatibility in the frontend test suite)
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
   | `MONGODB_URI`  | MongoDB connection string, e.g. `mongodb://127.0.0.1:27017/task-tracker` |
   | `JWT_SECRET`   | Secret used to sign and verify JWTs                                        |

3. (Optional) Seed the database with sample users, projects, and tasks:

   ```bash
   npm run seed
   ```

   (or, from the repo root: `make seed`)

      This clears existing `User`/`Project`/`Task` data and inserts:
      - 3 users — 1 admin (`admin@tasktracker.com`), 1 lead (`alice@tasktracker.com`), 1 member (`bob@tasktracker.com`), password `Admin123!` / `Password123!` respectively
      - 9 projects (one per lab-guide section) across `web`, `mobile`, and `data` categories (mix of `active` and `on-hold` statuses)
      - 33 tasks (drawn from the lab-guide checklist) spread evenly across every task status — tasks whose lab-guide entry had a bullet list get that list seeded as real, checkable `subtasks` rather than plain-text `description`, with completion matching the task's status (`todo`: none checked, `in-progress`: about half, `blocked`: just the first, `done`: all checked)

   ```mermaid
      pie showData title Seeded tasks by status
         "todo" : 9
         "in-progress" : 8
         "blocked" : 8
         "done" : 8
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

All routes are mounted under `/api`. Every route except `/api/health` and `/api/auth/register`/`/login` requires a `Authorization: Bearer <token>` header. `PUT`/`DELETE /api/auth/users/:id` and both `/api/admin/*` routes additionally require the token's user to have the `admin` role (403 otherwise) — every other route is open to any authenticated user regardless of role.

**Interactive docs:** with the server running, open `/api/docs` for a Swagger UI where you can browse and execute every endpoint below — log in via `POST /api/auth/login`, then click **Authorize** and paste the returned token to try authenticated requests. The raw OpenAPI spec is served at `/api/docs.json`.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Server + database connectivity check |
| POST | `/api/auth/register` | Create a user account (does not return a token — log in separately) |
| POST | `/api/auth/login` | Authenticate, returns a JWT and its expiry timestamp |
| GET | `/api/auth/me` | Return the authenticated user's profile |
| GET | `/api/auth/users` | List all users |
| PUT | `/api/auth/users/:id` | **Admin only.** Update a user's name/email/role/password |
| DELETE | `/api/auth/users/:id` | **Admin only.** Delete a user |
| GET | `/api/projects` | List projects (filter by `category`, `status`, `search`; paginated) |
| GET | `/api/projects/:id` | Get a single project (owner populated) |
| POST | `/api/projects` | Create a project (owner is set to the authenticated user) |
| PUT | `/api/projects/:id` | Update a project |
| DELETE | `/api/projects/:id` | Delete a project |
| GET | `/api/tasks` | List tasks (filter by `status`, `project`, `assignedTo`, `completedBy`, `search`; paginated) |
| GET | `/api/tasks/stats` | Aggregated task statistics |
| POST | `/api/tasks/ai-suggest-subtasks` | Suggest subtask text from a task title/description (keyword-based, not a real AI model call — see [Design](docs/DESIGN.md#ai-suggest-subtasks--ai-standup-not-real-ai)) |
| GET | `/api/tasks/:id` | Get a single task (project + assignee populated) |
| POST | `/api/tasks` | Create a task (`assignedTo` is optional and **not** auto-set — unlike a project's `owner`) |
| PUT | `/api/tasks/:id` | Update a task |
| POST | `/api/tasks/:id/notes` | Add a note to a task |
| POST | `/api/tasks/:id/subtasks` | Add a subtask (starts incomplete) |
| PATCH | `/api/tasks/:id/subtasks/:subtaskId` | Mark a subtask complete/incomplete — completing every subtask auto-marks the task `done` |
| DELETE | `/api/tasks/:id` | Delete a task |
| GET | `/api/dashboard` | Aggregated totals across tasks, projects, and users |
| GET | `/api/dashboard/ai-standup` | Rule-based "standup" summary grouped into yesterday/today/blockers (also not a real AI model call) |
| GET | `/api/admin/backup` | **Admin only.** Download a full JSON backup of the database (includes password hashes) |
| POST | `/api/admin/restore` | **Admin only.** Replace the entire database with an uploaded backup — destructive, no undo |

## Testing

```bash
npm test
```

The suite includes pure unit tests (models validation, middleware, utilities) and DB-backed tests that run against a dedicated test MongoDB database (default: `task-tracker-test`) — a local MongoDB instance must be reachable to run the full suite. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#testing) for details.

## Frontend

[`frontend-client/react-ts/`](frontend-client/react-ts/) is a React + TypeScript (Vite) client for the API above. See its [README](frontend-client/react-ts/README.md) for setup, routes, and auth flow — in short:

```bash
cd frontend-client/react-ts
npm install
npm run dev
```

The dev server proxies `/api/*` requests to the backend at `http://localhost:3000` (see `vite.config.ts`), so run `backend-api`'s dev server alongside it — or just run `make dev` from the repo root to start both together. No frontend-specific environment variables are required.

## Scripts

Reusable stack lifecycle scripts live in [Scripts](Scripts).

### Combined (dev + prod)

```bash
./Scripts/up-all.sh
./Scripts/down-all.sh
./Scripts/status-all.sh
```

`up-all.sh` starts both environments together and maps prod MongoDB to host port `37017` by default to avoid collisions with dev. Override with:

```bash
PROD_MONGO_PORT_WHEN_BOTH_UP=47017 ./Scripts/up-all.sh
```

### Dev only

```bash
./Scripts/up-dev.sh
./Scripts/down-dev.sh
./Scripts/status-dev.sh
```

### Prod only

```bash
./Scripts/up-prod.sh
./Scripts/down-prod.sh
./Scripts/status-prod.sh
```

### Quick reference

| Script | Target | Compose project | Notes |
|---|---|---|---|
| `Scripts/up-all.sh` | dev + prod | `tasktracker-dev` + `tasktracker-prod` | Starts both; prod Mongo host port defaults to `37017` when both run |
| `Scripts/down-all.sh` | dev + prod | `tasktracker-dev` + `tasktracker-prod` | Stops prod first, then dev |
| `Scripts/status-all.sh` | dev + prod | `tasktracker-dev` + `tasktracker-prod` | Prints both stacks' statuses |
| `Scripts/up-dev.sh` | dev | `tasktracker-dev` | Builds and starts dev stack |
| `Scripts/down-dev.sh` | dev | `tasktracker-dev` | Stops dev stack |
| `Scripts/status-dev.sh` | dev | `tasktracker-dev` | Shows dev stack status |
| `Scripts/up-prod.sh` | prod | `tasktracker-prod` | Ensures certs exist, then builds and starts prod stack |
| `Scripts/down-prod.sh` | prod | `tasktracker-prod` | Stops prod stack |
| `Scripts/status-prod.sh` | prod | `tasktracker-prod` | Shows prod stack status |

### ECR helper scripts (Kubernetes/EKS)

The `Scripts/` folder also includes helpers for cross-account ECR image pulls used by the `eks/` manifests:

| Script/File | Purpose |
|---|---|
| `Scripts/fix-ecr-cross-account.sh` | Applies ECR repository resource policies in the **owner account** to allow pull access from another AWS account/principal |
| `Scripts/ecr-consumer-pull-policy.json` | IAM policy document for the **consumer account** principal that performs image pulls |

Example (run in owner account credentials):

```bash
./Scripts/fix-ecr-cross-account.sh us-east-1 <owner-account-id> <consumer-account-id> arn:aws:iam::<consumer-account-id>:user/<principal-name>
```

Then in the consumer account, attach `Scripts/ecr-consumer-pull-policy.json` (or equivalent permissions) and refresh the Kubernetes image pull secret.

## Running with Docker

The whole stack (MongoDB, API, client) can also be run in containers instead of installing Node/MongoDB locally. Two Compose files are provided; both build `backend-api/Dockerfile` and `frontend-client/Dockerfile` and start a `mongo:7` container — pick one based on whether you want plain HTTP or HTTPS.

### Option 1: `docker-compose.yml` — plain HTTP (quick dev)

```bash
docker compose up -d --build
```

| Service | URL |
|---|---|
| Landing page | http://localhost:3000 |
| Client (React app) | http://localhost:3000/app |
| API | http://localhost:4000 |
| MongoDB | localhost:27017 |

The client container's nginx serves a static landing page at `/`, the React SPA at `/app`, and proxies `/api/*` to the `api` service, so the app works end-to-end at `http://localhost:3000` with no other setup.

If `docker compose up` fails with an "address already in use" error (commonly `27017`, `3000`, or `4000`), either stop the local service using that port or remap only the host side in `docker-compose.yml` (for example `"27018:27017"` for MongoDB).

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

`k8s/` has manifests for the same stack — MongoDB, API, client — as an alternative to either Compose file, for exercising the app in a real cluster (e.g. Docker Desktop's built-in Kubernetes). All resources live in a dedicated `task-tracker` namespace.

| File | Creates |
|---|---|
| `k8s/namespace.yaml` | The `task-tracker` namespace |
| `k8s/secrets.yaml` | Template for the `task-tracker-secrets` Secret (`PORT`, `NODE_ENV`, `JWT_SECRET`, `MONGODB_URI`) — placeholders only, see below |
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

kubectl create secret generic task-tracker-secrets \
   --namespace task-tracker \
  --from-literal=PORT=3000 \
  --from-literal=NODE_ENV=production \
  --from-literal=JWT_SECRET="$(grep -oP '(?<=^JWT_SECRET=).*' backend-api/.env | tr -d '"')" \
   --from-literal=MONGODB_URI="mongodb://mongo.task-tracker.svc.cluster.local:27017/task-tracker" \
  --dry-run=client -o yaml | kubectl apply -f -
```

**3. Apply the rest:**

```bash
kubectl apply -f k8s/mongo.yaml
kubectl apply -f k8s/api.yaml
kubectl apply -f k8s/client.yaml
```

**4. Access the app** at `http://localhost:30080` (Docker Desktop maps NodePort services to `localhost` automatically). To reach MongoDB directly (e.g. from Compass), it's ClusterIP-only, so tunnel it first: `kubectl port-forward svc/mongo -n task-tracker 27017:27017`, then connect to `mongodb://localhost:27017`.

If you change the Secret after `api`/`client` are already running, env vars are only injected at container start — re-apply the secret, then `kubectl rollout restart deployment/api -n task-tracker` (and/or `client`) to pick it up.

To tear everything down: `kubectl delete namespace task-tracker` — this deletes the Deployments, Services, the Secret, **and** the `mongo-data` PVC (and its backing volume, since Docker Desktop's default StorageClass reclaim policy is `Delete`), so any seeded data is lost with it.

## Running on EKS

`eks/` contains AWS-EKS-oriented manifests for the same app stack, using:

- namespace: `task-tracker`
- services: `mongo-svc`, `backend-api-svc`, `frontend-client-svc` (LoadBalancer)
- API/client images from ECR

### 1) Point kubectl to your cluster

```bash
aws eks update-kubeconfig --region us-east-1 --name task-tracker-eks
kubectl config current-context
```

### 2) Create namespace + image pull secret

```bash
kubectl apply -f eks/namespace.yml

aws ecr get-login-password --region us-east-1 | kubectl -n task-tracker create secret docker-registry ecr-registry \
   --docker-server=<your-account-id>.dkr.ecr.us-east-1.amazonaws.com \
   --docker-username=AWS \
   --docker-password="$(cat)" \
   --dry-run=client -o yaml | kubectl apply -f -
```

### 3) Apply EKS manifests

```bash
kubectl apply -f eks/secrets.yml
kubectl apply -f eks/mongo-deployment.yml
kubectl apply -f eks/backend-api.yml
kubectl apply -f eks/frontend-client.yml
```

### 4) Verify rollout + get public URL

```bash
kubectl -n task-tracker rollout status deployment/mongo
kubectl -n task-tracker rollout status deployment/backend-api
kubectl -n task-tracker rollout status deployment/frontend-client

kubectl -n task-tracker get svc frontend-client-svc
```

Use the `EXTERNAL-IP`/hostname from `frontend-client-svc` as the app URL.

### 5) Seed EKS Mongo data (optional)

```bash
kubectl -n task-tracker port-forward svc/mongo-svc 27017:27017
MONGODB_URI=mongodb://127.0.0.1:27017/task-tracker make seed
```

Stop port-forward with `Ctrl-C` when done.
