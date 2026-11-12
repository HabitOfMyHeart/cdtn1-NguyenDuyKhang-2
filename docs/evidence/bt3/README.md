# BT3 packaging verification evidence

This directory records real checks for sections 2.4 and 2.5. It is not a set of
Postman examples and must not be used as proof that API documentation is complete.

## Verification boundary

- Host: Windows/PowerShell with Docker Desktop running Linux containers.
- Docker Engine observed: `29.9.3`; Compose observed: `v5.7.0`.
- Node.js `24.21.0`, npm `11.19.0`, MongoDB container `8.0.17`.
- Final check: a fresh clone of published `main` at
  `7d51189e47b486e5b2660f9b7c6cfb1536cc82eb`, with no overlay. The earlier
  candidate runs used a local clone plus the packaging files before they were
  committed.
- The clone receives `.env` only by copying its committed `.env.example`.
  The main checkout's `.env`, `node_modules`, and database are not copied.
- Compose project used for the final run: `bt3-final-20261112`; host HTTP port
  `127.0.0.1:3001`.
- The existing host application on port `3000` was left running.
- No published `v1.0` clone is claimed. Commit/tag publication and a tag-based
  clean test remain separate actions requiring the student's approval.
- File hashes for the candidate are in `candidate-manifest.json`; the baseline
  commit is `ba69a763d3216b11ecd98d8b6801b1027d7668b8` plus the uncommitted files.

## Final results

### Clean clone from published main

- Source: `origin/main` at `7d51189e47b486e5b2660f9b7c6cfb1536cc82eb`, cloned
  with `git clone --depth 1` into a new empty directory.
- Only two setup commands were run: `Copy-Item .env.example .env`, then
  `docker compose up -d --build --wait --wait-timeout 180`.
- Compose exited `0`; `app` and `db` became `healthy`; only `127.0.0.1:3001`
  was published; the database published no host port.
- Readiness returned HTTP `200` with `status=ok` and `database=connected`.
- Initial data: 34 customer / 50 device / 50 ticket / 192 log / 6 center /
  6 category.
- The offline suite inside the app container reported 130 detected, 129 PASS,
  0 FAIL, 1 SKIP.
- Logs: `clean-clone/README.md`, `clean-clone-run.log`, `clean-clone-ps.txt`,
  `clean-clone-health.json`, `clean-clone-seed-counts.txt`,
  `clean-clone-tests.txt`.

### Earlier candidate build and startup

- `Copy-Item .env.example .env`: completed.
- `docker compose up -d --build --wait --wait-timeout 180`: exit `0`.
- `docker compose ps`: `app` and `db` both `healthy`; app published only
  `127.0.0.1:3001->3000/tcp`; database has no published host port.
- Build log: `final-build.txt`. Service state: `compose-ps.txt`.
- Runtime check: `app-runtime-inspect.txt`, `db-runtime-inspect.txt` and
  `runtime-versions.txt` record non-root user, read-only root filesystem,
  `cap_drop: ALL`, `no-new-privileges`, loopback-only HTTP and internal DB network.

### Data initialization

- First initialization created 34 customer / 50 device / 50 ticket / 192 log /
  6 service center / 6 issue category documents.
- Running migration and seed a second time exited `0` and left all six counts
  unchanged; see `seed-repeatability.txt`.
- After the live smoke test and restart checks, the demo counts were
  35 customer / 51 device / 51 ticket / 193 log / 6 center / 6 category because
  the smoke test wrote real fixtures. These counts are expected and are not a
  clean-seed baseline.
- Restarting the app container and restarting Docker Desktop preserved the newly
  created ticket; see `restart-persistence.txt`.

### Automated and live checks

- Host readiness: `host-health.json` shows HTTP `200`, `status=ok`,
  `database=connected`.
- Offline suite inside the app container: **130 detected, 129 PASS, 0 FAIL,
  1 SKIP**; log `container-tests.txt`. The single SKIP is the optional source
  re-extraction test, which needs `DATASET_SOURCE` and the original source file.
- Live smoke inside the app container: **PASS, 8/8 checks**, ticket `TCK0032`
  created and reloaded; log `docker-smoke.txt`.
- Host smoke guard: running `tests/docker-smoke.js` on the host is refused before
  any request is sent; log `host-smoke-refusal.txt`. This behavior has a
  regression test that failed before the guard and passes after it.
- Frontend assets `/`, app bundle and vendor files returned HTTP `200`; see
  `frontend-assets.txt`.
- Host coverage run: 77.56% lines, 79.08% branches, 67.66% functions. This is
  **not** an 80% coverage claim; raw output is `host-coverage.txt`.

### Static checks

- `node --check` on 51 project JavaScript files: 0 syntax failures.
- `docker compose config --quiet`: exit `0`; expanded environment values were
  not printed.
- `.env` is ignored, not tracked, and the checked Git history contains no
  `.env`/private `.env.*` path entries (public `.env.example` excluded).
- A bounded private-key/AWS/GitHub/API-key pattern scan found no matches in the
  tracked files; this does not prove absence of every possible secret pattern.
- `npm audit`: 2 High advisories affecting `body-parser` and `mongoose`; no
  automatic upgrades applied. The audit is not clean; raw output is
  `dependency-audit.json`.

## Evidence files

| File | Content |
|---|---|
| `final-build.txt` | Final `docker compose up --build --wait` output |
| `compose-ps.txt` | Final service status and published ports |
| `app-runtime-inspect.txt` | App user, root filesystem, capabilities, security options |
| `db-runtime-inspect.txt` | Database ports and network attachment |
| `runtime-versions.txt` | Node, npm and MongoDB versions inside containers |
| `seed-repeatability.txt` | First and second migration/seed counts |
| `container-tests.txt` | Full offline suite output inside the app container |
| `host-tests.txt` | Full offline suite output on the host |
| `host-coverage.txt` | Coverage output on the host |
| `syntax-check.txt` | `node --check` result for 51 JavaScript files |
| `git-diff-check.txt` | `git diff --check` result (exit 0) |
| `docker-smoke.txt` | Live smoke result and ticket ID |
| `host-smoke-refusal.txt` | Host execution refusal with no request sent |
| `host-health.json` | Host readiness response through port 3001 |
| `frontend-assets.txt` | HTTP 200 checks for the UI, bundle and vendor assets |
| `restart-persistence.txt` | Ticket survives app and Docker Desktop restart |
| `dependency-audit.json` | Raw `npm audit` result (2 High) |
| `candidate-manifest.json` | SHA-256 of the packaging files |
| `clean-clone/` | Fresh clone of published `main`, two commands, two-command results |
| `docker-login.png` | Real screenshot of the Docker build login page |

## Attachments not yet available

- A clone of tag `v1.0` and a repeat of the two setup commands from that tag.
  The tag must be created after section 2.6 and the PDF are finished.
- A public Render URL and any cloud-database deployment. These are optional and
  are not claimed here.
