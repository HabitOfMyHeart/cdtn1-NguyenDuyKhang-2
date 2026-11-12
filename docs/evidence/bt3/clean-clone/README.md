# Clean-clone verification for section 2.4

**Date:** 12/11/2026
**Source:** `https://github.com/HabitOfMyHeart/cdtn1-NguyenDuyKhang-2`
**Published commit:** `7d51189e47b486e5b2660f9b7c6cfb1536cc82eb` (`main`)
**Scope:** fresh clone, no working-tree overlay. This is **not** a clone of a
published `v1.0` tag; the tag does not exist yet.

## Commands

The clone was created with `git clone --depth 1` into a new empty directory.
Inside that directory only these two setup commands were run:

1. `Copy-Item .env.example .env`
2. `docker compose up -d --build --wait --wait-timeout 180`

No host `.env`, `node_modules`, database or private dataset was copied.

## Observed result

| Check | Result | File |
|---|---|---|
| Compose exit code | `0` | `clean-clone-run.log` |
| Services | `app` and `db` both `healthy` | `clean-clone-ps.txt` |
| Published port | `127.0.0.1:3001->3000/tcp` only; database has no host port | `clean-clone-ps.txt` |
| Readiness | HTTP `200`, `status=ok`, `database=connected` | `clean-clone-health.json` |
| Initial data | 34 customer, 50 device, 50 ticket, 192 log, 6 center, 6 category | `clean-clone-seed-counts.txt` |
| Offline suite inside the app container | 130 detected, 129 PASS, 0 FAIL, 1 SKIP | `clean-clone-tests.txt` |

The one SKIP is the optional source re-extraction test, which requires
`DATASET_SOURCE` and the original source file; all required test types ran.

## Limits

- A clone of tag `v1.0` and a repeat of these commands from that tag are still
  pending. The tag is created only when the repository owner orders it.
- This is a local demo, not a production deployment. See
  [the security checklist](../../../checklist-bao-mat.md) for the three items that
  remain explicitly not done.
