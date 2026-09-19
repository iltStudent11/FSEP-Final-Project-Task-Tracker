# Design

This document covers the data model and API design decisions behind the tracker, and the tradeoffs made along the way. For how the code is wired together, see [`ARCHITECTURE.md`](ARCHITECTURE.md).

> All file paths below (`src/...`, etc.) are relative to [`backend-api/`](../backend-api/), where the application lives.

## Data model

```mermaid
erDiagram
    USER ||--o{ POLICY : owns
    USER ||--o{ CLAIM : "assigned to"
    USER ||--o{ CLAIM_NOTE : authors
    POLICY ||--o{ CLAIM : "filed against"
    CLAIM ||--o{ CLAIM_NOTE : has

    USER {
        string name
        string email
        string password
        string role
    }
    POLICY {
        string policyNumber
        string holderName
        string type
        number premium
        string status
        date effectiveDate
        date expirationDate
        ObjectId owner
    }
    CLAIM {
        string claimNumber
        ObjectId policy
        string description
        date incidentDate
        number amount
        string status
        ObjectId assignedTo
    }
    CLAIM_NOTE {
        ObjectId author
        string text
        date createdAt
    }
```

### User

| Field | Type | Notes |
|---|---|---|
| `name` | String | required, trimmed |
| `email` | String | required, unique, lowercased, trimmed |
| `password` | String | required, min 8 chars, hashed with bcrypt (12 rounds) in a `pre("save")` hook |
| `role` | `"adjuster" \| "admin"` | defaults to `adjuster` |
| `createdAt` | Date | defaults to now |

The password is only rehashed when `isModified("password")` is true, so updating unrelated fields (e.g. `name`) doesn't churn the hash. `toJSON()` strips `password` so it's never accidentally serialized in an API response, even though the field is still fetched from the DB (needed for `comparePassword`).

### Policy

| Field | Type | Notes |
|---|---|---|
| `policyNumber` | String | required, unique, uppercased, trimmed |
| `holderName` | String | required, trimmed |
| `type` | `"auto" \| "home" \| "life"` | required |
| `premium` | Number | required, min 0 |
| `status` | `"active" \| "expired" \| "cancelled"` | required |
| `effectiveDate` / `expirationDate` | Date | required |
| `owner` | ObjectId ref → `User` | required |
| `createdAt` | Date | defaults to now |

`policyNumber` is uppercased at the schema level so `"pol-100"` and `"POL-100"` are treated as the same policy and collide on the unique index — this is enforced by MongoDB, and a duplicate submission surfaces as a 409 via the centralized error handler rather than a raw 500.

### Claim

| Field | Type | Notes |
|---|---|---|
| `claimNumber` | String | unique, **auto-generated** (`CLM-1000`, `CLM-1001`, …) |
| `policy` | ObjectId ref → `Policy` | required |
| `description` | String | required |
| `incidentDate` | Date | required |
| `amount` | Number | min 0 |
| `status` | `"submitted" \| "under-review" \| "approved" \| "denied" \| "closed"` | defaults to `submitted` |
| `assignedTo` | ObjectId ref → `User` | set from the authenticated user on creation |
| `notes` | `[{ author: ObjectId → User, text: String, createdAt: Date }]` | embedded sub-documents, no separate `_id` |
| `createdAt` / `updatedAt` | Date | via schema `{ timestamps: true }` |

**Claim number generation** happens in a `pre("save")` hook: on a new document with no `claimNumber` yet, it calls `countDocuments()` on the collection and derives `CLM-${1000 + count}`. This keeps numbers human-readable and roughly sequential without a separate counter collection.

> **Known tradeoff:** this counter approach has a race condition under concurrent inserts — two claims saved at the same instant could compute the same count and collide on the unique index. At this project's expected scale (a handful of adjusters filing claims, not a high-throughput system) that's an acceptable risk; a dedicated atomic counter document (`findOneAndUpdate` with `$inc`) would be the fix if that assumption changes. The seed script (`src/seed.ts`) sidesteps this entirely by creating claims sequentially rather than in parallel.

Notes are embedded rather than a separate collection because they're always accessed in the context of their claim, never independently queried or paginated — embedding avoids an extra join/populate for what is effectively a claim's activity log.

**Typical status lifecycle** (shown for reference — the API does **not** currently enforce these transitions; `PUT /api/claims/:id` accepts any valid enum value regardless of the claim's current status):

```mermaid
stateDiagram-v2
    state "under-review" as under_review
    [*] --> submitted
    submitted --> under_review
    submitted --> denied
    under_review --> approved
    under_review --> denied
    approved --> closed
    denied --> closed
```

## API design

- **Resource-oriented REST.** `/api/policies` and `/api/claims` follow standard REST verbs (`GET`/`POST`/`PUT`/`DELETE`), with one deliberate extra: `POST /api/claims/:id/notes` as a sub-resource action, since appending a note isn't really "replacing" the claim (a `PUT` would imply that).
- **Pagination** is `page`/`limit` query params (default 1/10, capped at 100) on both list endpoints, returning `{ items, pagination: { page, limit, total, pages } }`. Kept minimal (offset-based) rather than cursor-based since the dataset sizes here don't warrant it.
- **Filtering** is done via query params matched directly to indexed/enum fields (`type`, `status`, `policy`, `assignedTo`) plus a `search` param that does a case-insensitive regex match across the couple of free-text fields that make sense to search (`holderName`/`policyNumber` for policies, `claimNumber`/`description` for claims). Search input is regex-escaped before being used to avoid a user-supplied pattern breaking the query or causing catastrophic backtracking.
- **Validation happens before the database is touched.** `express-validator` chains run in the `validate` middleware ahead of every mutating route, so most bad input (missing fields, invalid enums, malformed ObjectIds) never reaches Mongoose. The centralized error handler's `ValidationError`/`CastError` branches exist as defense-in-depth for anything that bypasses that layer (a script, a future route), not as the primary validation path.
- **`GET /api/claims/stats` is registered before `GET /api/claims/:id`** — otherwise Express would match `/stats` as an `:id` param and route it to the wrong handler.
- **Dashboard vs. per-resource stats.** `/api/claims/stats` and `/api/dashboard` overlap (both surface claims-by-status and totals) by design: `/claims/stats` is scoped to claims for a claims-focused view, while `/dashboard` aggregates across claims, policies, and users for an at-a-glance summary. Duplicating the small aggregation pipeline was judged simpler than building a shared abstraction for two call sites.

### API reference

All routes are mounted under `/api` (see `src/server.ts`). "Auth" is `Authorization: Bearer <token>` via the `authenticate` middleware, which loads the user by the token's `id` and 401s on a missing/invalid/expired token. Every body/query field below is enforced by an `express-validator` chain in the route (`src/routes/*.ts`) before the handler runs — a failing chain returns `400` with a `message`/`errors` list from the shared `validate` middleware, not the handler's own logic.

#### Health

| | |
|---|---|
| **`GET /api/health`** | Auth: none |

No parameters. Returns `{ status: "ok" \| "error", db: "connected" \| "disconnected" \| "connecting" \| "disconnecting" \| "unknown" }`, `503` when `db` isn't `"connected"`.

#### Auth (`/api/auth`)

| | |
|---|---|
| **`POST /api/auth/register`** | Auth: none |

Body:

| Field | Type | Required | Constraints |
|---|---|---|---|
| `name` | string | yes | non-empty (trimmed) |
| `email` | string | yes | valid email; normalized (lowercased) |
| `password` | string | yes | min 8 chars |
| `role` | `"adjuster" \| "admin"` | no | defaults to `adjuster` |

`409` if `email` is already registered. `201` with `{ user }` (no token — log in separately).

| | |
|---|---|
| **`POST /api/auth/login`** | Auth: none |

Body: `email` (string, required, valid email), `password` (string, required, non-empty).

`401` on no matching user or wrong password. `200` with `{ token, expiresAt, user }`.

| | |
|---|---|
| **`GET /api/auth/me`** | Auth: required |

No parameters. Returns `{ user }` for the authenticated token.

#### Policies (`/api/policies`)

| | |
|---|---|
| **`GET /api/policies`** | Auth: required |

Query params (all optional):

| Param | Type | Constraints |
|---|---|---|
| `type` | string | one of `auto`, `home`, `life` |
| `status` | string | one of `active`, `expired`, `cancelled` |
| `search` | string | case-insensitive match against `holderName` or `policyNumber` |
| `page` | integer | `>= 1`; defaults to `1` |
| `limit` | integer | `1`-`100`; defaults to `10` |

Returns `{ policies, pagination: { page, limit, total, pages } }`, sorted by `createdAt` descending.

| | |
|---|---|
| **`GET /api/policies/:id`** | Auth: required |

Path: `id` (MongoDB ObjectId, required). `404` if not found. Returns `{ policy }` with `owner` populated (password excluded).

| | |
|---|---|
| **`POST /api/policies`** | Auth: required |

Body:

| Field | Type | Required | Constraints |
|---|---|---|---|
| `policyNumber` | string | yes | non-empty (trimmed) |
| `holderName` | string | yes | non-empty (trimmed) |
| `type` | string | yes | one of `auto`, `home`, `life` |
| `premium` | number | yes | `>= 0` |
| `status` | string | yes | one of `active`, `expired`, `cancelled` |
| `effectiveDate` | string | yes | ISO 8601 date |
| `expirationDate` | string | yes | ISO 8601 date |

`owner` is set to the authenticated user, not accepted from the body. `409` on a duplicate `policyNumber`. `201` with `{ policy }`.

| | |
|---|---|
| **`PUT /api/policies/:id`** | Auth: required |

Path: `id` (ObjectId, required). Body: same fields as `POST`, all optional (each still validated when present). `404` if not found. Returns `{ policy }`.

| | |
|---|---|
| **`DELETE /api/policies/:id`** | Auth: required |

Path: `id` (ObjectId, required). `404` if not found, else `204` with no body.

#### Claims (`/api/claims`)

| | |
|---|---|
| **`GET /api/claims`** | Auth: required |

Query params (all optional):

| Param | Type | Constraints |
|---|---|---|
| `status` | string | one of `submitted`, `under-review`, `approved`, `denied`, `closed` |
| `policy` | string | MongoDB ObjectId |
| `assignedTo` | string | MongoDB ObjectId |
| `search` | string | case-insensitive match against `claimNumber` or `description` |
| `page` | integer | `>= 1`; defaults to `1` |
| `limit` | integer | `1`-`100`; defaults to `10` |

Returns `{ claims, pagination: { page, limit, total, pages } }`, sorted by `createdAt` descending.

| | |
|---|---|
| **`GET /api/claims/stats`** | Auth: required |

No parameters. Returns `{ totalClaims, totalAmount, byStatus: { submitted, "under-review", approved, denied, closed } }` (every status key present, `0` if unused). Registered before `/:id` so it isn't swallowed by the `:id` param route.

| | |
|---|---|
| **`GET /api/claims/:id`** | Auth: required |

Path: `id` (ObjectId, required). `404` if not found. Returns `{ claim }` with `policy` fully populated and `assignedTo` populated (password excluded).

| | |
|---|---|
| **`POST /api/claims`** | Auth: required |

Body:

| Field | Type | Required | Constraints |
|---|---|---|---|
| `policy` | string | yes | MongoDB ObjectId |
| `description` | string | yes | non-empty (trimmed) |
| `incidentDate` | string | yes | ISO 8601 date |
| `amount` | number | no | `>= 0` |

`claimNumber` is auto-generated and `assignedTo` is set to the authenticated user; neither is accepted from the body. `status` defaults to `submitted` and can't be set on create. `201` with `{ claim }`.

| | |
|---|---|
| **`PUT /api/claims/:id`** | Auth: required |

Path: `id` (ObjectId, required). Body (all optional):

| Field | Type | Constraints |
|---|---|---|
| `policy` | string | MongoDB ObjectId |
| `description` | string | non-empty (trimmed) |
| `incidentDate` | string | ISO 8601 date |
| `amount` | number | `>= 0` |
| `status` | string | one of `submitted`, `under-review`, `approved`, `denied`, `closed` |
| `assignedTo` | string | MongoDB ObjectId |

No transition rules are enforced — any valid `status` value is accepted regardless of the claim's current status (see [Known tradeoff](#claim) above). `404` if not found. Returns `{ claim }`.

| | |
|---|---|
| **`POST /api/claims/:id/notes`** | Auth: required |

Path: `id` (ObjectId, required). Body: `text` (string, required, non-empty, trimmed). Appends `{ author: <authenticated user>, text, createdAt: now }` to the claim's embedded `notes` array. `404` if the claim isn't found. `201` with `{ claim }` (full claim, including the new note).

| | |
|---|---|
| **`DELETE /api/claims/:id`** | Auth: required |

Path: `id` (ObjectId, required). `404` if not found, else `204` with no body.

#### Dashboard (`/api/dashboard`)

| | |
|---|---|
| **`GET /api/dashboard`** | Auth: required |

No parameters. Returns:

| Field | Description |
|---|---|
| `totalClaims` | Count of all claims |
| `claimsByStatus` | `{ submitted, "under-review", approved, denied, closed }` (all keys present, `0` if unused) |
| `totalPolicies` | Count of all policies |
| `policiesByType` | `{ auto, home, life }` (all keys present, `0` if unused) |
| `totalUsers` | Count of all users |
| `recentClaims` | Most recent 5 claims, `policy` fully populated and `assignedTo` populated (password excluded) |
| `totalClaimAmount` | Sum of `amount` across all claims (`0`-valued/missing amounts treated as `0`) |

## Security & auth

- **JWT payload is intentionally minimal** — just `{ id, role }` — to keep tokens small and avoid embedding data that could go stale (e.g. `name`/`email`) before the token expires. Anything else needed is fetched fresh via `authenticate` looking up the user by id on every request.
- **Passwords never leave the server.** Hashed at rest (bcrypt, 12 rounds), stripped from every JSON response via `toJSON()`, and never logged.
- **CORS is currently unrestricted** (`cors()` with no `origin` option). Now that `frontend-client/react-ts/` exists, tightening this to `cors({ origin: process.env.CLIENT_ORIGIN })` is a known follow-up rather than a hypothetical one — it just hasn't been prioritized yet since the frontend's dev server proxies `/api` same-origin and there's no deployed client origin to lock down to.
- **Health check reflects real DB state**, not just process liveness — `GET /api/health` reports `mongoose.connection.readyState` and returns 503 when MongoDB is unreachable, so uptime monitoring can distinguish "server up, DB down" from "all healthy."
