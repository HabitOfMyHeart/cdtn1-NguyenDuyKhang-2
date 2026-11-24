# White-box test from tag `v1.0`

**Run:** 23/11/2026 (local, real PowerShell console; not a replayed image).  
**Repository:** `https://github.com/HabitOfMyHeart/cdtn1-NguyenDuyKhang-2.git`  
**Tag:** `v1.0` (annotated tag object `b2d7589`; peeled commit `4aaeb2a`).

Commands, in a fresh temporary directory:

```powershell
git clone --branch v1.0 --depth 1 https://github.com/HabitOfMyHeart/cdtn1-NguyenDuyKhang-2.git bt3-tag-v1.0-clone
Set-Location bt3-tag-v1.0-clone
git describe --tags --exact-match
git rev-parse HEAD
npm ci --no-audit --no-fund
npm test
```

Observed result:

| Check | Result |
|---|---|
| Checked-out commit | `4aaeb2af67a8ba62d83d4fc6d2a078efd3a580e2` |
| `npm ci` exit code | `0` |
| `npm test` exit code | `0` |
| Tests | `130` |
| PASS | `129` |
| FAIL | `0` |
| SKIP | `1` (`DATASET_SOURCE` not set) |

Files:

- `tag-v1.0-terminal.png` — full console capture.
- `tag-v1.0-terminal-cropped.png` — cropped for the report.
- `transcript.txt` — PowerShell transcript of the same run. The transcript
  replaces the Node `ℹ` marker with `?` because of the console code page; the
  screenshot is the visual source of truth.

The clone prints an annotated-tag warning (`refs/tags/v1.0 ... is not a commit!`)
and checks out the peeled commit `4aaeb2a`. This is expected for an annotated tag
and is visible in `transcript.txt`.

The tag was not moved or recreated. The current `main` adds the S2/S3 hardening
tests and has 133 tests (132 PASS, 0 FAIL, 1 SKIP); that second run is recorded in
`docs/test-report.md` and the report's Section 7.
