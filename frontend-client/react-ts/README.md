# Task Tracker — Frontend

A React + TypeScript client for the [`backend-api`](../../backend-api/) Task Tracker API, built with Vite.

## Tech stack

- **Framework:** React 19 + TypeScript, built/served with Vite
- **Routing:** `react-router-dom` (client-side routes, see below)
- **HTTP:** `axios`, with a shared instance (`src/api.ts`) that attaches the stored JWT and redirects to `/login` on an unrecoverable 401
- **Styling:** plain CSS with a token-based design system (`src/index.css` custom properties + `src/App.css` shared components — cards, badges, buttons, tables)
- No state management library — auth state lives in React context (`AuthContext`), everything else is local component state plus API calls.

## Setup

```bash
npm install
npm run dev
```

This starts the Vite dev server (prints the local URL, typically `http://localhost:5173`). It proxies any `/api/*` request to `http://localhost:3000` (see `vite.config.ts`), so the [`backend-api`](../../backend-api/) dev server must be running separately (`cd ../../backend-api && npm run dev`) with a reachable MongoDB instance — **and its `PORT` must be `3000`** (the backend defaults to `5000` if `PORT` is unset in its `.env`; the proxy target here is hardcoded, not configurable via env var). No frontend-specific environment variables are needed — the API base URL is always the relative `/api`.

Alternatively, run this client (and the API + MongoDB) in Docker instead of installing anything locally — see the root [README](../../README.md#running-with-docker). `frontend-client/Dockerfile` builds this app with Vite and serves it via nginx, which also handles the `/api/*` proxy that `vite.config.ts` handles in dev.

For Kubernetes/EKS deployment paths (including external LoadBalancer access and ECR-backed images), see the root [README Kubernetes section](../../README.md#running-on-kubernetes) and [README EKS section](../../README.md#running-on-eks).

To log in, use one of the accounts created by the backend's `npm run seed` (e.g. `admin@tasktracker.com` / `Admin123!`), or register a new account from `/register`.

## npm scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Vite dev server with HMR |
| `npm run build` | Type-check (`tsc -b`) and build to `dist/` |
| `npm run lint` | Run ESLint |
| `npm run preview` | Serve the production build locally |

## Routes

| Path | Component | Access |
|---|---|---|
| `/login` | `Login` | public |
| `/register` | `Register` | public |
| `/` | `Dashboard` | protected |
| `/tasks` | `Tasks` | protected |
| `/projects` | `Projects` | protected |
| `/admin` | `Admin` | protected, **admin role only** |

Protected routes are wrapped in `ProtectedRoute`, which redirects to `/login` when there's no stored token and otherwise renders the shared `Banner` (nav + user identity + role badge + logout) above the page. `Footer` renders on every route, including the public auth pages. `/admin` has a second guard, `AdminRoute`, wrapped *inside* `ProtectedRoute` — it redirects non-admins to `/` rather than `/login` (they're authenticated, just not authorized), and `Banner` only renders the "Admin" nav link for `user.role === "admin"` in the first place. This is a UX convenience, not a security boundary — the backend's `authorizeRoles("admin")` middleware is what actually enforces it; see [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md#authorization).

## Auth flow

- `AuthContext`/`AuthProvider` (`src/AuthContext.tsx`, `src/auth-context.ts`) hold `user`, `token`, and `login`/`register`/`logout`, backed by `localStorage` (see `TOKEN_STORAGE_KEY` in `src/api.ts`).
- `POST /api/auth/register` does not return a token (per the backend design — see [`docs/DESIGN.md`](../../docs/DESIGN.md)), so `Register` navigates to `/login` on success instead of expecting a token back; `Login` shows a "just registered" success message via router state.
- The shared `api` axios instance attaches `Authorization: Bearer <token>` to every request and clears the stored token + hard-redirects to `/login` on a 401 — except on `/auth/login` and `/auth/register` themselves, where a 401 is an expected "bad credentials" response the caller needs to handle inline, not a session expiry.
- `useAuth()` is the hook every component uses to read auth state; it throws if called outside `AuthProvider`.

## Pages

- **Dashboard** (`/`) — summary stat cards, tasks-by-status chart, projects-by-category summary, a table of recent tasks from `GET /api/dashboard`, and an "AI Standup Summary" card from `GET /api/dashboard/ai-standup` (fetched alongside the main stats via `Promise.allSettled`, so a failure there doesn't block the rest of the page — see [`docs/DESIGN.md`](../../docs/DESIGN.md#ai-suggest-subtasks--ai-standup-not-real-ai) for why "AI" here is a rule-based summary, not a real model call).
- **Tasks** (`/tasks`) — paginated, filterable (status + search) task list with an inline "New Task" form, a per-task subtask checklist (add/toggle, with "AI Suggest Subtasks" pre-filling suggestions from the task's title/description via `POST /api/tasks/ai-suggest-subtasks`), and a notes thread per task.
- **Projects** (`/projects`) — paginated, filterable (category + search) project list with inline create and per-row delete.
- **Admin** (`/admin`, admin role only) — lists every user with inline edit (name/email/role/password) and delete, plus a "Backup & Restore" panel: download a full JSON database backup, or upload one to replace the entire database (destructive — gated behind typing a confirmation phrase before the button is enabled).
- **Login** / **Register** — auth forms; `Register` redirects to `/login` on success (see Auth flow above).

Status badges (`StatusBadge`) and their color tones are centralized in `src/claimStatus.ts` and `src/policyMeta.ts` — the filenames are a holdover from this app's earlier insurance-claims domain and export `TASK_STATUS_*`/`PROJECT_*` constants today, not anything claims/policy-related; they haven't been renamed to match. Both keep task/project status coloring consistent across dashboard and list views.
