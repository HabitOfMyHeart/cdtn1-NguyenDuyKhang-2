# Smart CRM — Mekong Mobile API documentation (BT3, section 2.6)

This folder is the API documentation deliverable for the L2 intake flow of
Smart CRM — Mekong Mobile. It documents **23 distinct endpoints** through
**25 requests**, because two endpoints are intentionally requested twice so the
cleanup examples can be captured without deleting the records used by earlier
requests.

Every request carries seven English documentation sections and one saved
response example captured on 12/11/2026 from the running local demo.

## Files

| File | Purpose |
|---|---|
| `Smart-CRM-Mekong-Mobile-API-BT3.postman_collection.json` | Postman Collection v2.1 with 25 requests, 25 embedded response examples, collection-level Bearer auth and the login token-capture script |
| `bt3-local.postman_environment.json` | Environment `BT3 Local Demo`; `baseUrl` points at the Docker demo on port 3001, secrets are empty |
| `verification.json` | Machine-checked counts for this deliverable (25 requests, 23 endpoints, 25 examples, 25 requests with seven sections, 0 Vietnamese characters in descriptions) |
| `README.md` | This guide |

The collection is derived from the author's working Postman collection. The
original files outside the repository were not modified.

## What was verified

Checked on 12/11/2026 against the files in this folder:

| Check | Result |
|---|---|
| Collection parses as JSON and declares schema `v2.1.0` | Yes |
| Requests in the collection | 25 |
| Distinct method + path pairs | 23 |
| Requests with exactly the seven required sections | 25 / 25 |
| Requests with one embedded saved response | 25 / 25 |
| Vietnamese characters inside request descriptions | 0 |
| Login example JWT | Replaced with `<redacted-demo-jwt>` |
| Environment secrets committed | None (`accessToken` and `password` are empty) |

The counts are reproducible from `verification.json`.

## Prerequisites

- Postman Desktop or the Postman web app.
- A running local demo with the sample data:
  - Docker: follow [`../deployment-guide.md`](../deployment-guide.md); the API
    listens on `http://localhost:3001`.
  - Direct Node.js run: `npm start`; the API listens on
    `http://localhost:3000`.
- The demonstration employee credentials configured for the local demo. The
  username is `nhanvien`; the password is intentionally **not** stored in this
  repository. Read it from your local `.env`/seed configuration and type it
  into the Postman environment.

## Import and run

1. Open Postman → **Import** → select both
   `Smart-CRM-Mekong-Mobile-API-BT3.postman_collection.json` and
   `bt3-local.postman_environment.json`.
2. Select the **BT3 Local Demo** environment in the environment selector.
3. Open the environment and set:
   - `password` — your local demo password (secret, kept only in Postman).
   - `baseUrl` — leave `http://localhost:3001` for Docker, or change it to
     `http://localhost:3000` for `npm start`.
4. Run the folders in order **01 → 07**. The login request stores
   `accessToken` and `centerId` in the active environment; every later request
   inherits the collection-level `Bearer {{accessToken}}` auth.
5. Keep the environment selected. If you switch environments, run
   `02 - Login` again before the authenticated requests.

### Execution order

| Folder | Requests | Why this order |
|---|---|---|
| `01 - Health` | Health check | Confirms the service and database are ready; no auth |
| `02 - Authentication` | Login, Current user | Login captures the JWT and center used by all later requests |
| `03 - Catalogs` | List catalogs, Suggest category priority | Captures `categoryId` and shows the SLA suggestion |
| `04 - Customers` | Create test customer, Create delete-only customer, List/search, Get, Update | Creates the customers used by devices and tickets |
| `05 - Devices` | Create test device, Create delete-only device, List, Lookup, Get, Update | Devices depend on an existing customer; lookup supports warranty checks |
| `06 - Tickets` | Preview SLA, Create ticket, List/search, Get, History, Update, Delete | Preview writes nothing; create captures `ticketId`; update runs before the soft delete |
| `07 - Cleanup` | Delete separate test device, Delete separate test customer | Uses the records reserved by `07b` and `11b` so earlier examples stay intact |

## Endpoint reference

All paths are relative to `{{baseUrl}}`. "Auth" means the collection-level
Bearer token; `noauth` requests work without a token.

| # | Method | Path | Purpose | Auth | Success |
|---|---|---|---|---|---|
| 1 | GET | `/health` | Check whether the web service and MongoDB connection are ready | No | 200 |
| 2 | POST | `/api/auth/login` | Authenticate the demo employee and return a JWT | No | 200 |
| 3 | GET | `/api/auth/me` | Return the authenticated employee identity | Bearer | 200 |
| 4 | GET | `/api/catalogs` | List service centers and issue categories | Bearer | 200 |
| 5 | GET | `/api/catalogs/categories/{categoryId}/suggest` | Return a category with its suggested priority and SLA length | Bearer | 200 |
| 6 | POST | `/api/customers` | Register a customer with a unique normalized phone number | Bearer | 201 |
| 7 | GET | `/api/customers` | List customers or look up by phone/search text | Bearer | 200 |
| 8 | GET | `/api/customers/{customerId}` | Retrieve a non-deleted customer | Bearer | 200 |
| 9 | PUT | `/api/customers/{customerId}` | Edit supported customer profile fields | Bearer | 200 |
| 10 | DELETE | `/api/customers/{customerId}` | Soft-delete a customer when no blocking references exist | Bearer | 200 |
| 11 | POST | `/api/devices` | Register a device for a customer and assess warranty | Bearer | 201 |
| 12 | GET | `/api/devices` | List non-deleted devices, optionally filtered | Bearer | 200 |
| 13 | GET | `/api/devices/lookup` | Find a device by serial number and warranty status at a receipt time | Bearer | 200 |
| 14 | GET | `/api/devices/{deviceId}` | Retrieve a device and its warranty result | Bearer | 200 |
| 15 | PUT | `/api/devices/{deviceId}` | Update device fields and recalculate warranty | Bearer | 200 |
| 16 | DELETE | `/api/devices/{deviceId}` | Soft-delete a device not referenced by an active ticket | Bearer | 200 |
| 17 | POST | `/api/tickets/preview` | Calculate a proposed due date without writing to the database | Bearer | 200 |
| 18 | POST | `/api/tickets` | Create a MOI ticket, calculate SLA and write the first history entry | Bearer | 201 |
| 19 | GET | `/api/tickets` | List tickets visible to the employee, with optional filters | Bearer | 200 |
| 20 | GET | `/api/tickets/{ticketId}` | Retrieve ticket details and status history | Bearer | 200 |
| 21 | GET | `/api/tickets/{ticketId}/history` | Read recorded status changes of a ticket | Bearer | 200 |
| 22 | PUT | `/api/tickets/{ticketId}` | Update intake details of a MOI ticket and recalculate SLA if needed | Bearer | 200 |
| 23 | DELETE | `/api/tickets/{ticketId}` | Soft-delete a MOI ticket in the employee center | Bearer | 200 |

Duplicate-endpoint requests, kept on purpose:

| Request | Endpoint | Reason |
|---|---|---|
| `07b - Prepare separate delete-only customer` | `POST /api/customers` | Creates the record deleted by request 23 so request 07/08/09/10 examples stay valid |
| `11b - Prepare separate delete-only device` | `POST /api/devices` | Creates the record deleted by request 22 so request 11/12/14/15 examples stay valid |

The contract itself, including shared error shapes and the 14-key ticket
envelope, is documented in [`../api-contract.md`](../api-contract.md).

## The seven documentation sections

Each request description follows the same structure and is written in English:

1. **Method and path** — verb, path and purpose of the call.
2. **Business purpose** — why the intake flow needs this call.
3. **Authentication and access** — token requirement, role and center scope.
4. **Parameters and request body** — path/query fields, body fields and validation rules.
5. **Successful response body** — expected shape and the important fields.
6. **Error codes** — status codes and the conditions that produce them.
7. **Limitations and known constraints** — what the endpoint does not do.

The saved examples show the actual response body captured from the demo; the
descriptions explain the contract rather than restating one response.

## Saved response examples

- There is exactly one embedded example per request, named with its status code
  and the capture date.
- The login example is the only example whose `data.token` value is replaced
  with `<redacted-demo-jwt>`; every other field is the captured response.
- Customer and ticket examples show the API's masked phone format
  (`0900***101`), not a full phone number.
- Identifiers such as `TCK0032`, `customerId` and `deviceId` are records from
  the seeded demo on 12/11/2026. They are evidence, not fixed fixtures.

## Known limitations

- The collection has **not** been executed end-to-end as one Postman/Newman run
  in this repository. The 25 examples were captured request by request against
  the running local demo on 12/11/2026, and the files were checked for
  structure, counts and secrets. A single green collection run is still
  pending.
- The examples reflect one seeded demo database at one point in time. Running
  the create requests again on the same database can return `409` because the
  test phone numbers and serial numbers must be unique. Use a fresh demo stack
  (`docker compose down -v`, then `docker compose up -d --build --wait`) or
  change `testPhone`, `deletePhone`, `serialNo` and `deleteSerialNo` before
  rerunning.
- The customer, device and ticket deletes are soft deletes with reference
  checks. Ticket deletion is limited to `MOI`; a customer or device referenced
  by a live ticket is rejected.
- `PUT /api/tickets/{ticketId}` changes intake fields; the collection does not
  document an unrestricted status-transition endpoint because the submitted
  frontend does not expose one.
- This is a local demonstration API over HTTP. HTTPS, rate limiting, a
  production reverse proxy and a cloud deployment are out of scope; see
  [`../checklist-bao-mat.md`](../checklist-bao-mat.md) for the three security
  items that remain explicitly not done.
- There is no public deployment URL. The collection is not claimed to work
  against a hosted environment.
