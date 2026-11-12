# Deployment Guide — Smart CRM, Mekong Mobile

**Student:** Nguyen Duy Khang — 2374802010212 · **Track:** SE · **Flow:** L2

**Repository:** https://github.com/HabitOfMyHeart/cdtn1-NguyenDuyKhang-2

**Status:** Verified on fresh clones of published `main` at commits
`7d51189` and, most recently, `c055f81`, with no working-tree overlay. Both services became healthy, the
initial sample data matched, and the offline suite passed inside the app
container. Tag `v1.0` has not been cloned or re-tested, so a tag-based clean run
is still pending. Sections 1–5 describe the reproducible local Docker demo.
Section 6 records the separately verified public Render/Atlas demo; neither is
claimed to be production-ready.

## 1. Prerequisites

| Requirement | Version / condition |
|---|---|
| OS | Windows with Docker Desktop/WSL 2, or Linux with Docker Engine; Linux containers |
| Git | Required to clone the repository |
| Docker | Engine 24+ and Compose 2.20+; daemon must be running |
| Host port | TCP `3001` available; HTTP is bound to `127.0.0.1` only |
| Disk / network | Reserve approximately 3 GB, an estimate; internet needed for initial downloads |
| Runtime images | Node `24.21.0-bookworm-slim`, MongoDB `8.0.17`, both pinned by digest |

Node.js, npm, Python and MongoDB need not be installed on the host. MongoDB has
no published host port; the application uses an internal Docker network and a
project-scoped volume for database access, plus a web network to publish HTTP.
Do not connect this deployment to the main database.

## 2. Setup Instructions

After `v1.0` is published, obtain the source and enter its directory:

```bash
git clone --branch v1.0 https://github.com/HabitOfMyHeart/cdtn1-NguyenDuyKhang-2.git
```

```bash
cd cdtn1-NguyenDuyKhang-2
```

There are **two setup commands after cloning**. In a fresh checkout only:

> The commands below were executed successfully on a fresh clone of published
> `main` at commit `7d51189`, with no working-tree overlay.

**1. Create configuration — choose one command for your OS.**

PowerShell:

```powershell
Copy-Item .env.example .env
```

Linux:

```bash
cp .env.example .env
```

Do not overwrite an existing `.env`. The committed sample works for this local
demo without manual secret editing; its key/password are not production secrets.

**2. Build and start:**

```bash
docker compose up -d --build --wait --wait-timeout 180
```

Dependency installation uses `npm ci`. MongoDB must become healthy first.
`docker/start-demo.js` runs migration and seed on first initialization, records
completion in `_bt3_deployment`, then starts the server. It refuses any database
URI other than `mongodb://db:27017/mekong_bt3_demo`. Subsequent starts skip
initialization and preserve application edits. This is a single-app-instance demo.

Open **http://localhost:3001**. Local demo login: **`nhanvien / nhanvien123`**,
center `1`. These are public sample credentials, not production credentials.
The case-study data must not be assumed to be anonymized or cleared for public use.

## 3. Environment Variables

Compose does not load the host's whole `.env` into the container. Only the signing
key and optional Docker host port are interpolated; the database URI and demo
identity are explicitly fixed in `docker-compose.yml`. Editing the host
`MONGODB_URI` cannot redirect Docker initialization to the main database.

| Variable | Meaning | Docker value/default | Source / required |
|---|---|---|---|
| `BT3_HTTP_PORT` | Published loopback HTTP port | `3001` | Optional `.env` override; not the container port |
| `PORT` | Container HTTP port | `3000` | Fixed by Compose |
| `NODE_ENV` | Runtime mode | `development` | Fixed local-demo mode |
| `MONGODB_URI` | Isolated database | `mongodb://db:27017/mekong_bt3_demo` | Fixed by Compose |
| `JWT_SECRET` | Access-token signing key | Development placeholder from `.env.example` | Required in `.env`; never commit a private key |
| `JWT_EXPIRES_IN` | Token lifetime | `8h` | Fixed by Compose |
| `DEMO_STAFF_USERNAME` | Demo login name | `nhanvien` | Fixed by Compose |
| `DEMO_STAFF_PASSWORD` | Public demo password | `nhanvien123` | Fixed by Compose; not production-safe |
| `DEMO_STAFF_NAME` | Demo display name | `Local demo employee` | Fixed by Compose |
| `DEMO_STAFF_CENTER` | Employee's center | `1` | Fixed by Compose |
| `LOG_LEVEL` | Application log verbosity | `info` | Fixed by Compose |
| `DB_SERVER_SELECTION_TIMEOUT_MS` | Database selection timeout | `3000` ms | Application default |
| `DB_CONNECT_TIMEOUT_MS` | Database connection timeout | `3000` ms | Application default |
| `DB_SOCKET_TIMEOUT_MS` | Database socket timeout | `10000` ms | Application default |
| `HTTP_REQUEST_TIMEOUT_MS` | Request timeout | `30000` ms | Application default |
| `HTTP_HEADERS_TIMEOUT_MS` | Header timeout | `10000` ms | Application default |
| `SHUTDOWN_TIMEOUT_MS` | Shutdown timeout | `10000` ms | Application default |

`DATASET_SOURCE` is an optional offline source-re-extraction test input, not a
deployment prerequisite. The source dataset and its private paths are not copied
into the image. These two local commands do not provision Render or Atlas;
the hosted deployment is described separately in section 6.

## 4. Sample Data

Initialization automatically uses the committed files in `data/sample/`:

| Collection | Initial documents |
|---|---:|
| `customer` | 34 |
| `device` | 50 |
| `ticket` | 50 |
| `ticket_status_log` | 192 |
| `service_center` | 6 |
| `issue_category` | 6 |

`_bt3_deployment` additionally contains one technical initialization marker,
not a customer/account or business sample record. Counts above are before any
manual or integration-test writes. The center-1 UI does not display all 50 tickets.

**Before editing data**, verify migration and seed repeatability:

```bash
docker compose exec -T app npm run db:migrate
```

```bash
docker compose exec -T app npm run db:seed
```

Both must exit `0` with unchanged business counts. These are verification commands,
not extra setup steps. Seed refuses other/modified records rather than overwriting
them. Do not rerun it as a reset after adding demo data. Migration synchronizes
indexes, so run it only on the authorized demo database. Initialization is not a
concurrent migration system or a cross-collection transaction.

## 5. Verification and Troubleshooting

**Service readiness:**

```bash
docker compose ps
```

Both `app` and `db` must report `healthy`, not merely `running`.

PowerShell:

```powershell
Invoke-RestMethod http://localhost:3001/health
```

Linux:

```bash
curl -fsS http://localhost:3001/health
```

Expected HTTP `200`, `status=ok`, `database=connected`; service and timestamp
fields are also returned. HTTP `503`/`degraded` is not a passing readiness result.

**All business collection counts (run before write checks):**

```bash
docker compose exec -T db mongosh mekong_bt3_demo --quiet --eval "for (const n of ['customer','device','ticket','ticket_status_log','service_center','issue_category']) print(n + ': ' + db.getCollection(n).countDocuments({}))"
```

**Offline automated suite, one command:**

```bash
docker compose exec -T app npm test
```

Expected exit `0`, no FAIL. Report PASS and SKIP separately. The optional original
source-re-extraction test remains SKIP without `DATASET_SOURCE`/Python. The image
includes the test files and dependencies; it does not fabricate the missing source.

**Live application/database check, optional and writes demo fixtures:**

```bash
docker compose exec -T app node tests/docker-smoke.js
```

Expected `status=PASS`. This checks login, create/reload of a customer/device/MOI
ticket, duplicate-ticket refusal, HTTP validation and cross-center access refusal.
It changes demo counts and stores an operational test-ticket reference in the
metadata collection. Its cross-center token is a test-only trusted identity, not
a second account provided by the login endpoint. No token or source PII is printed.

For a manual check, log in, open the list, and create a new test customer/device
and intake ticket. Reload the ticket to verify persistence; never assume a seeded
device is free of open tickets. Warranty `null` means unverified, not expired.

**Logs:**

```bash
docker compose logs --tail=50 app db
```

| Symptom | Action |
|---|---|
| Docker daemon unavailable | Start Docker Desktop/Engine and retry |
| Port `3001` occupied | Use a free `BT3_HTTP_PORT` in this checkout's `.env`; update verification URLs accordingly |
| Missing `JWT_SECRET` | Create `.env` from the public sample in a fresh checkout; do not reveal a private key |
| Initialization/seed conflict | Preserve data; inspect the dedicated database and step logs; do not force-reset |
| App unhealthy | Check database health and startup logs; a visible login page alone is insufficient |

Stop without deleting database data:

```bash
docker compose down
```

`down -v` deletes the project's data. Do not run it without deliberately choosing
to discard this demo volume, and never use system-wide pruning for this test.
For a fresh test, use a separate checkout/Compose project with new volumes.

### Validation status

Multiple runs are recorded: an earlier pre-commit packaging candidate, a fresh
published-main clone at `7d51189`, and a new isolated clone at `c055f81`.

**Fresh clone of published main, 12/11/2026:**

| Check | Observed result |
|---|---|
| Source | `origin/main` at `7d51189`, cloned with `git clone --depth 1` |
| Two setup commands | `.env` copied, then `docker compose up -d --build --wait --wait-timeout 180` |
| Compose exit code | `0` |
| Service health | `app` and `db` both `healthy` |
| Published ports | `127.0.0.1:3001->3000/tcp` only; database has no host port |
| Host readiness | HTTP `200`, `status=ok`, `database=connected` |
| Initial sample data | 34 customer / 50 device / 50 ticket / 192 log / 6 center / 6 category |
| Offline suite inside the app container | 130 detected, 129 PASS, 0 FAIL, 1 SKIP |

**Additional fresh-main check, `c055f81`, 12/11/2026:** a new checkout and Compose
project/volume used the same setup commands. `BT3_HTTP_PORT=3002` was set in the
verification process because port 3001 was occupied by the preserved source
stack; this override does not change the default two-command setup. Compose
returned 0, both services were healthy, readiness was HTTP 200, migration and
seed repeated with identical counts, and the container suite was 130/129/0/1.
The first log wrapper misclassified Docker stderr progress as a PowerShell
error; rerunning the same Compose command with native exit-code checking passed,
without an application change. The verification stack was stopped without
deleting its volume. See `evidence/bt3/render/fresh-main/`; UTF-8 log captures were
made after restarting that same isolated stack, then it was stopped again.

**Earlier candidate run, same file content before commit:**

| Check | Observed result |
|---|---|
| Repeat migration and seed | exit `0`; all six counts unchanged |
| Live smoke | PASS, 8/8 checks, ticket `TCK0032` created and reloaded |
| Restart persistence | New ticket survived container restart and Docker Desktop restart |
| Runtime hardening | non-root, read-only root, `cap_drop: ALL`, `no-new-privileges`, loopback-only HTTP |
| Frontend assets | `/`, app bundle and vendor assets returned HTTP 200 |

This is **not** a clone of the `v1.0` tag. The live smoke wrote
fixtures, so the earlier candidate counts differ from the clean-clone counts
above; the fresh clone stayed at the initial sample counts. See the
[security checklist](checklist-bao-mat.md) for known limitations; this prototype
must not be represented as production-ready.

## 6. Optional hosted demo — Render and MongoDB Atlas

- **Live URL:** https://cdtn1-nguyenduykhang-2.onrender.com/
- **Health:** https://cdtn1-nguyenduykhang-2.onrender.com/health
- **Verified:** 12 November 2026. Render service `cdtn1-NguyenDuyKhang-2`, Docker,
  Free, Singapore, GitHub repository above, branch `main`, deployed commit `c055f81`.
  This records the actual optional deployment for assignment section 3.3, not a
  guarantee of bonus marks or continuous availability.

### Steps actually performed

1. Provision the Atlas Free cluster `MekongMobile`; configure database access and
   narrowly scoped Network Access entries. Add the migration computer's current
   public IP, not `127.0.0.1` or `0.0.0.0/0`. On Render, use **Connect → Outbound**
   to obtain the service's CIDR ranges and allow them in Atlas. Existing matching
   Render ranges were retained; a successful deployed database connection was observed.
2. Pause the source Docker app briefly, run official `mongodump` against
   `mekong_bt3_demo`, copy the gzip archive outside Git, compare source snapshots,
   then unpause the app. The source database and the Windows database were not
   changed. Source MongoDB was `8.0.17`; Atlas was `8.0.37`.
3. Authenticate with a locally entered database password kept in memory. Verify
   `mekong_bt3_render` contains no collections. Restore only the six application
   namespaces with official `mongorestore 100.20.1`, `--gzip`,
   `--nsFrom="mekong_bt3_demo.*"`, `--nsTo="mekong_bt3_render.*"` and
   `--stopOnError`. Do not use `--drop`, restore users/roles, or seed Atlas.
   The local-only `_bt3_deployment` marker was deliberately excluded.
4. Use the existing Render Docker service linked to this repository. Keep
   **Docker Command = `node src/server.js`**, with an empty Pre-Deploy Command.
   The image's default local-demo bootstrap is intentionally bypassed: it refuses
   Atlas URIs and is not a production migration tool.
5. In Render **Environment**, set `MONGODB_URI` to the authenticated Atlas SRV URI
   with **database path `/mekong_bt3_render`** and `authSource=admin`; SRV uses TLS.
   The previous URI had no database path. Credentials were preserved and were
   never copied into this guide, Git, `.env.example` or Docker images.
6. Select **Save and deploy**, reusing the existing image. Deploy
   `dep-dbqt2he7bikc73ak2kv0` succeeded; its logs recorded `database.connected`.
   Read back the saved database path and verify health plus read-only business calls.

### Render settings: observed values and limits

| Setting | Observed configuration |
|---|---|
| Runtime / region / plan | Docker / Singapore / Free |
| Docker Command | `node src/server.js` |
| Pre-Deploy Command | Empty; no seed or migration over restored data |
| `MONGODB_URI` | Atlas URI stored only in Render; database `mekong_bt3_render`, `authSource=admin`, TLS |
| `NODE_ENV` | `development`, retained for this prototype; **not production mode** |
| `PORT` | `3000`; the server listens on the platform-facing interface |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Existing runtime values retained; no values disclosed; JWT key fails the application's production validation |
| `DEMO_STAFF_USERNAME`, `DEMO_STAFF_PASSWORD`, `DEMO_STAFF_NAME`, `DEMO_STAFF_CENTER` | Existing demo identity retained, center `1`; password fails production validation |
| Database timeouts | App defaults: selection/connect `3000` ms, socket `10000` ms; not separately tuned on Render |
| Health-check configuration | Manual HTTPS `/health` verified; Render's custom Health Check Path was empty when inspected |

### Observed acceptance results

Restore exited `0`: **338 restored, 0 failed**. Counts were customer `34`, device
`50`, ticket `50`, ticket_status_log `192`, service_center `6`, issue_category `6`.
Canonical Extended JSON document digests, all **30 indexes**, collection options
and collection names matched the source; all seven relationship checks found zero
orphans/mismatches. Physical collection UUIDs are not preserved or required.

The hosted checks returned HTTP `200`: readiness (`ok`/`connected`), demo login,
catalog read, center-scoped list (9 matching ticket IDs), detail, and history
(5 matching rows for the chosen ticket). Tokens, login passwords and customer
records were not saved in the evidence. No create/update/delete calls were run
against Atlas during acceptance.

Evidence: [`evidence/bt3/render/`](evidence/bt3/render/),
[`render-login.png`](screenshots/bt3/render-login.png),
[`render-health.png`](screenshots/bt3/render-health.png).

### Limits and recheck before marking

Render Free can sleep and delay the first request. Open the live URL and confirm
HTTP `200` plus `status=ok` and `database=connected` immediately before assessment.
A login page alone does not prove database readiness. If unavailable, inspect
Render logs and Atlas Network Access; do not reset databases or rerun seeds.

This public demo does not establish production security: development mode,
sample authentication, client-side token storage, incomplete customer/device
ownership, and two High dependency advisories remain. Case-study provenance does
not establish consent, anonymization or public-use rights; deployment does not
resolve that privacy risk. Address these before any real/public customer use.
