# Render / Atlas and pre-tag evidence — 12 November 2026

Public demo: https://cdtn1-nguyenduykhang-2.onrender.com/  
Readiness: https://cdtn1-nguyenduykhang-2.onrender.com/health

These are actual sanitized execution results, not generated sample responses.
No authenticated URI, password, JWT, BSON archive, customer record or private
Atlas login state is included. Full database backups remain outside Git.

| File | What it establishes |
|---|---|
| `atlas-migration-summary.json` | Empty Atlas destination checked; 338 documents restored successfully with official Tools 100.20.1; six collection counts, document digests, 30 indexes and options match; seven relationship checks have no errors |
| `render-integration.json` | Actual saved target database, successful environment-triggered deploy, startup/readiness checks; unchanged Docker Command; known hardening gaps |
| `render-readonly-verification.json` | Six live acceptance checks; 9 matching center-1 tickets and 5 history rows for the selected ticket; no business writes |
| `npm-audit-summary.json` | Two High advisories remain, not a clean security result |
| `test-file-counts.json` | Counts from separate actual runs of all 14 test files: 130 total, 129 PASS, 1 SKIP |
| `fresh-main/summary.json` | New clone of published main `c055f81`, isolated project/volume, repeat migration/seed unchanged, suite PASS; not a tag-based clone |
| `fresh-main/ps-utf8.txt`, `tests-utf8.txt` | Real native stdout captured without a PowerShell transcoding wrapper after restarting the same verification stack; no edited/fabricated output |
| Other `fresh-main/` logs | Initial setup/verification and original log-capture wrapper details, including harmless stderr/npm-notice capture artifacts |

Screenshots under `docs/screenshots/bt3/`:

- `render-login.png`, `render-health.png`: actual hosted pages captured in the browser.
- `fresh-main-services.png`, `fresh-main-tests.png`: browser captures displaying
  the complete original log files, scrolled to the test summary where applicable.
  They are **not screenshots of a live terminal**, and do not show a tag-based clone.

The source Docker application was briefly paused during its binary backup, then
unpaused. Its before/after document digests and indexes were unchanged. The local
Windows database was not used for this migration. The technical local-only
`_bt3_deployment` collection was deliberately excluded from Atlas.

Hosted success is separate from security readiness: development mode, sample
credentials/key validation, broad Atlas account permissions, incomplete record
ownership, data public-use rights/anonymization and dependency advisories remain
unresolved. A successful migration is not proof that the data is safe to publish.

`v1.0` has not been created/pushed or tested. The public GitHub release-page and
tag-source-download checks cannot pass until that release point exists.
