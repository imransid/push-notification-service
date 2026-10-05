# Push notifications audit (Go Style)

- **Date:** 2026-10-05
- **Mode:** read only. No code changed, nothing committed, no migrations run, no containers touched.
- **Ran:** `yarn test` (unit), `tsc --noEmit`, and `yarn lint` in the push service.
- **Did not run:** `yarn test:e2e`. It boots the whole app against Postgres, and the app runs `CREATE TABLE` / `CREATE INDEX` on start.
- **Secrets:** never printed. Values are reported only as "present" or "missing".

## Repos audited

| # | Repo | Path | Branch @ HEAD |
|---|------|------|---------------|
| 1 | Push service | `jumatech/push-notification-service` | `main` @ `ce35c00` (plus an uncommitted edit to `docker-compose.yml`, see R7) |
| 2 | Login API for the mobile app | `jumatech/gostyle-customer-api` (Django). README line 3: "The consumer-facing HTTP API behind the GoStyle mobile app" | `main` @ `6203a1b` |
| 3 | React Native app | **Not on this machine.** Searched all of `/Users/rafa` to depth 9 (14 RN apps found, none is Go Style; no Flutter, no native). | n/a |
| 4 | booking-api | `jumatech/gostyle-booking-api` (NestJS + Prisma, Swarm). `gostyle-booking-api-series` is a second clone of the same repo on `feat/mobile-series-rules`. | `main` @ `cb84fe7` |

Every branch of every repo was searched (`git log --all`) for push, device-token, FCM and notification work. Nothing push-related exists outside the push service and customer-api.

## Summary

| Phase | Status | Biggest gap |
|-------|--------|-------------|
| 1. Devices table + PUT/POST devices | **DONE** (code) | Schema is created at boot (`CREATE TABLE IF NOT EXISTS`), not by migrations, and has no tests |
| 2. POST /notifications/user | **PARTIAL** | Unique key is `(user_id, event_id, device_token)`, not `(user_id, event_id)`. A notification is lost if Redis fails between insert and enqueue. No tests. |
| 3. Merge + deploy | **Merged / server CAN'T VERIFY** | Repo publishes port 3351, and `8085` appears nowhere in the code, so the server runs config that isn't in git |
| 4. customer-api /me/device-tokens | **NOT STARTED** | No endpoint, no push client, no env var. A separate `device` table exists that nothing writes to. |
| 5. Mobile app | **CAN'T VERIFY FROM CODE** | The app repo isn't on this machine |
| 6. booking-api → POST /notifications/user | **NOT STARTED** | No caller. The outbox's final publisher only logs. |
| 7. Hardening | **PARTIAL** | No HTTPS/domain for push. No cleanup jobs. Redis is published on the host with no password. |
| 8. Outbox in booking-api | **EXISTS** | `event_outbox` and `OutboxRelay` are live; the publisher is a logging stub |

---

## Phase 1: devices table, PUT /devices, POST /devices/unregister

| Item | Status | Evidence | Missing |
|------|--------|----------|---------|
| `devices` table: `user_id, app, token UNIQUE, platform, status, last_seen_at` | DONE | `src/notification/infrastructure/postgres-device.repository.ts:21-32`. `token TEXT NOT NULL UNIQUE` (L26), `status DEFAULT 'active'` (L28), `last_seen_at` (L29), plus `id`, `created_at`. Index `devices_user_status_idx` (L33-36). Commit `e51d310`. | **No migration.** The table is created in `onModuleInit` with `CREATE TABLE IF NOT EXISTS`, so a later column change won't reach an existing table (R8). |
| PUT /devices upserts by token | DONE | `device.controller.ts:21-25` → `upsert()` `postgres-device.repository.ts:46-58`: `ON CONFLICT (token) DO UPDATE` (L50) | — |
| ...and always refreshes `last_seen_at` | DONE | `last_seen_at = now()` in the conflict branch (L55). New rows use the column default. It also resets `status='active'` and moves the token to the new `user_id` (L44-45, L51, L54). | — |
| POST /devices/unregister | DONE | `device.controller.ts:27-32` → `remove()` `postgres-device.repository.ts:75-81`. Hard `DELETE` by token; returns `{ ok, removed }`. | Deletes by token only, with no `userId` scope (R12) |
| Both behind x-api-key | DONE | Class-level `@UseGuards(ApiKeyGuard)` `device.controller.ts:16`. Guard `api-key.guard.ts:13-16` reads `process.env.API_KEY` and rejects when it's unset. Swagger lock icon added in `ce35c00`. | — |
| DTO validation | DONE | `device.dto.ts:4-30`: `platform` in `['android','ios']`, token ≥ 10 characters. `ValidationPipe({ whitelist: true })` in `main.ts:8`. | — |
| **Done when** (the pasted plan had no "Done when" text, so this is inferred): a device registered twice is one row with a fresh `last_seen_at`; unregister removes it; both return 401 without the key | DONE in code / CAN'T VERIFY on server | Logic as above | No test covers any of it. Run the Phase 3 commands to check the server. |

## Phase 2: POST /notifications/user

| Item | Status | Evidence | Missing |
|------|--------|----------|---------|
| Body `userId, eventId, title, body, data` | DONE | `send-user-notification.dto.ts:4-35`. Route `notification.controller.ts:51-66`, 202. Commit `18b92db`. | `data` is only `@IsObject()`; values aren't checked to be strings (R3) |
| One queued send per ACTIVE device | DONE | `findActiveTokens()` `postgres-device.repository.ts:60-66` (`status = 'active'`, L62). One `Notification` plus one BullMQ job per token: `send-user-notification.handler.ts:29-54`, 3 attempts, exponential backoff (L48-52). | — |
| UNIQUE `(user_id, event_id)` enforced in the DB | **PARTIAL** | DB-enforced, but as a partial unique index on **`(user_id, event_id, device_token)`** `WHERE event_id IS NOT NULL`: `postgres-notification.repository.ts:38-42`. Insert uses `ON CONFLICT DO NOTHING` (L54-58); the handler skips the job when nothing was inserted (handler L40-45). | Not the key the plan names. With one row per device, a strict `(user_id, event_id)` key would block the second device, so you need either a separate `user_events(user_id, event_id) PK` table claimed first, or a plan change. Effect today: replaying an eventId after the user adds a phone sends to the new phone (R4). |
| FCM "not registered" marks the device invalid | DONE (untested) | `send-notification.processor.ts:14-17` (`registration-token-not-registered`, `invalid-registration-token`) and L49-52 `markInvalid()` → `postgres-device.repository.ts:68-73`. `fcm-push-sender.ts:40-46` rethrows the original error, so `.code` survives. | No test asserts `markInvalid` is called; `18b92db` only added the mock. `messaging/mismatched-credential` isn't treated as dead (R16). |
| POST /notifications unchanged (git history) | DONE (one side effect) | `git diff 0096ac3 HEAD` shows zero changes to `send-notification.dto.ts`, `send-notification.command.ts`, `send-notification.handler.ts`, `fcm-push-sender.ts` and `api-key.guard.ts`. `notification.controller.ts` only gained imports (L34-35) and the new route (L51-66); `send()` (L68-101) is byte-identical. The `findById` change in the repo is formatting only. | The shared processor now also runs `markInvalid` for raw `POST /notifications` jobs. The request/response contract is unchanged. |
| **Done when** (inferred): two calls with the same eventId send once per device; dead tokens drop out | PARTIAL | See above | Tests for the handler, dedupe and dead tokens; the bugs in R1 and R2 |

## Phase 3: merge and deploy

| Item | Status | Evidence |
|------|--------|----------|
| Branch merged? | **YES** | `feature/device-registry` = `18b92db` is an ancestor of `main` (`git merge-base --is-ancestor`). Fast-forward, so there's no merge commit. `main` is one commit ahead with `ce35c00` (Swagger lock icon only). |
| Commit the server should run | **`ce35c00`** | `main`, `origin/main` (imransid), `jumatechs/main` and `entity/main` all point at `ce35c00` (last fetch 2026-10-05 19:03). `18b92db` is functionally the same. |
| Server is running it | CAN'T VERIFY | — |
| Port 8085 | CAN'T VERIFY / **mismatch** | The repo has no `8085` anywhere. `docker-compose.yml:34-35` and `docker-stack.yml:32-33` publish `3351:3351`; README uses 3351. The server must have an uncommitted override. |
| Local uncommitted change | Note | `docker-compose.yml` adds `NODE_ENV: development` (working tree only). If it's committed and deployed, `/docs` becomes public (R7). |

**Commands to run on the server (all read-only; none print secret values):**

```bash
# 0. Find the container and where it was started from
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}' | grep -iE 'push|8085'
docker inspect <container> --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}'

# 1. Code on disk (run in that dir)
git rev-parse --short HEAD     # expect ce35c00 (18b92db at minimum)
git status --short             # expect empty
git diff --stat                # server-only edits, e.g. the 8085 port mapping

# 2. Is the running image built from that code?
docker inspect <container> --format '{{.Created}} {{.Image}}'   # should be after 2026-10-05 17:10 +06
docker compose exec app grep -c notifications_user_event_device_uq dist/notification/infrastructure/postgres-notification.repository.js   # expect 1
docker compose exec app grep -c DEAD_TOKEN_CODES dist/notification/application/send-notification.processor.js                           # expect >= 1

# 3. Env vars: presence only
docker compose exec app sh -c 'for v in API_KEY FIREBASE_KEY_PATH DATABASE_URL REDIS_HOST; do eval x=\$$v; [ -n "$x" ] && echo "$v present" || echo "$v missing"; done'
docker compose exec app sh -c 'test -s "$FIREBASE_KEY_PATH" && echo "firebase key present" || echo "firebase key missing"'
docker compose exec app printenv NODE_ENV PORT     # expect NODE_ENV=production

# 4. Schema
docker compose exec db psql -U postgres -d push -c '\d devices'
docker compose exec db psql -U postgres -d push -c '\d notifications'     # look for notifications_user_event_device_uq
docker compose exec db psql -U postgres -d push -c "SELECT status, count(*) FROM devices GROUP BY 1"

# 5. HTTP, deliberately without the key
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8085/docs                        # expect 404
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:8085/notifications/user  # 401 = new code, 404 = old code
curl -s -o /dev/null -w '%{http_code}\n' -X PUT  http://127.0.0.1:8085/devices             # 401 = new code, 404 = old code

# 6. Exposure
ss -ltnp | grep -E ':8085|:3351|:6381|:5432'
sudo ufw status || sudo iptables -S | head -30
# from your laptop:
nc -vz <server-ip> 6381        # should FAIL (Redis has no password)
curl -s -o /dev/null -w '%{http_code}\n' http://<server-ip>:8085/docs

# 7. Logs reach Loki?
docker ps --filter name=alloy  # is an Alloy task on this host?
# Grafana Explore: {service=~".*push.*"} over the last hour
```

## Phase 4: customer-api `POST` / `DELETE /me/device-tokens`

| Item | Status | Evidence | Missing |
|------|--------|----------|---------|
| `POST /me/device-tokens` | NOT STARTED | `apps/accounts/urls.py` has no such route; `device-tokens` appears nowhere in the repo or its branches | Everything |
| `DELETE /me/device-tokens` | NOT STARTED | Same | Everything. `LogoutView` (`apps/accounts/views.py:174-183`) only blacklists the refresh token and leaves devices alone. |
| `userId` from the verified session, never from the body | NOT STARTED (groundwork exists) | JWT `USER_ID_CLAIM: "consumer_id"` (`config/settings/base.py:241-251`), so `request.user.id` is the right source. `IsVerified` explicitly lists "registering a push device" (`apps/accounts/permissions.py:26`). | Use `IsVerified` and `request.user.id` when the endpoint is built |
| Push API key from env, not hardcoded | NOT STARTED | No `PUSH_*` setting in `config/settings/`. The current push key appears in no file and no git history of customer-api, booking-api or platform. | Settings plus an HTTP client |
| Existing related code | Note | `Device` model (`apps/accounts/models.py:164-203`, migration `0007_consumeraccount_currency_consumeraccount_image_and_more`) with `push_token UNIQUE`, `platform`, `is_active`, `last_seen_at`. Nothing writes to it; `/auth/me` reads `push_token` from it (`serializers.py:126-132`). | Decide which table is the source of truth (R11) |
| **Done when** (inferred): a logged-in app call registers or removes its token in the push service under the session user | NOT STARTED | — | — |

## Phase 5: mobile app

| Item | Status | Evidence |
|------|--------|----------|
| Permission asked after login | CAN'T VERIFY FROM CODE | Repo not on this machine |
| Token sent after login / every launch / on refresh | CAN'T VERIFY FROM CODE | Same. The server side it would call (Phase 4) doesn't exist yet, so this can't be working end to end. |
| Token deleted on logout | CAN'T VERIFY FROM CODE | Same. The server side doesn't exist. |
| Tap opens booking from `data.bookingId`, background **and** killed | CAN'T VERIFY FROM CODE | Same. Note: `SendUserNotificationDto` uses `bookingId` as its example key (`send-user-notification.dto.ts:30`), but no producer sends it yet. |
| iOS APNs setup referenced anywhere | **NO** (in available repos) | The only mention is a to-do in `gostyle-platform/docs/decisions/customer-app-architecture.md:145` ("push provider integration (FCM/APNs)"). `fcm-push-sender.ts:35-39` sends no `apns` block. Whether an APNs auth key is uploaded in the Firebase console can't be seen from code. |

**Action:** clone the app repo, or tell me where it is, and re-run this phase.

## Phase 6: booking-api calls POST /notifications/user

| Item | Status | Evidence |
|------|--------|----------|
| Call after the booking is saved | NOT STARTED | No `notifications/user`, push client or `PUSH_*` env in any branch |
| `eventId` = `booking:<id>:<status>` | NOT STARTED | — |
| 3s timeout, 3 retries | NOT STARTED | — |
| Never throws | NOT STARTED | — |
| `data` values all strings | NOT STARTED | Matters because the push service doesn't enforce it (R3) |

Context for building it:

- Every status change already writes an event in the **same transaction** as the booking:
  - `lifecycle.repository.ts:338-347` writes `booking.<to>` (with `session.started` for `in_service`).
  - `booking.repository.ts:333-336` writes `booking.confirmed`.
  - `reschedule.repository.ts:287,527` writes `booking.rescheduled`.
  - Hooking the push call into the outbox chain (Phase 8) gives "after the booking is saved" for free.
- "Never throws" conflicts with the relay's retry. If the publisher swallows errors, the outbox marks the event published even when the push failed. Pick one owner for retries.
- **Identity:** booking-api knows only `booking.customer_id`. The push `userId` will be customer-api's `consumer_id`. The group path passes the ConsumerAccount id as `customerId` (`customer-api apps/salons/group_views.py:701`, `group_translate.py:178-180`), so the two line up there. Check the single-booking path, and staff-created bookings for walk-in customers without an app account (R10).

## Phase 7: hardening

| Item | Status | Evidence | Missing |
|------|--------|----------|---------|
| HTTPS / domain for push | NOT STARTED (code) / CAN'T VERIFY (server) | No TLS, proxy or domain config in the push repo. customer-api's nginx has only `api.gostyle.uk.conf` and `logs.gostyle.uk.conf`. | A vhost or private-network-only decision. App and Redis ports are published on `0.0.0.0` (R6). |
| `/docs` hidden | DONE (code) / CAN'T VERIFY (server) | `main.ts:10-25` mounts Swagger only when `NODE_ENV !== 'production'`; `Dockerfile:12` sets `NODE_ENV=production`; the committed compose and stack files don't override it | The uncommitted `NODE_ENV: development` in `docker-compose.yml` would expose it (R7) |
| Old API key in code | None found | No non-placeholder `API_KEY` value in any file. `.env.example` has a 9-character placeholder in all 3 revisions. `docker-stack.yml:25` uses `${API_KEY}`. | — |
| Old API key in git history | None found (limited) | `git log --all -p` on every branch: no key value. The current local key appears 0 times in the history of push, customer-api, booking-api and platform. **I don't know the old key's value**, so I couldn't search for it directly. | Run `git log --all -p -S'<old key>' \| wc -l` in each repo yourself (expect 0) |
| Committed env files | Clean | The only env-like file ever committed is `.env.example`. `.env` and `firebase-service-account.json` are gitignored (`.gitignore:42,60-62`) and dockerignored. Locally, `.env` and the Firebase JSON are **present** and ignored. | — |
| Other committed config | Note | `web-test/index.html:10-53` and `web-test/firebase-messaging-sw.js:4-7` contain the Firebase **web** config (web apiKey, sender ID, VAPID public key), committed in `0096ac3`. These are public client values by design, not the service API key. Postgres default credentials are hard-coded in `docker-compose.yml:5,28`, `docker-stack.yml:5,26` and as code fallbacks (R15, R17). | — |
| Alloy includes the push container | IMPLICIT / CAN'T VERIFY | `gostyle-customer-api/observability/alloy/config.alloy:44-90` discovers **every** container through `docker.sock`, including non-Swarm Compose ones (fallback rule L65-72). The service runs `mode: global` (`docker-stack.observability.yml:62`). Push logs are collected only if push runs on a node with an Alloy task. | Explicit check (Phase 3, step 7) |
| Cleanup: old devices | NOT STARTED | No schedule or cron in `src/`; `@nestjs/schedule` isn't a dependency. `invalid` devices stay forever. | Job |
| Cleanup: old notifications | NOT STARTED | Nothing deletes from `notifications`. BullMQ jobs are added without `removeOnComplete` / `removeOnFail` (`send-user-notification.handler.ts:48-52`, `send-notification.handler.ts:36-40`), so Redis keeps every job (R5). | Job plus job retention |

## Phase 8: outbox in booking-api (report only)

**Yes, a working outbox already exists.**

- **Table:** `event_outbox` (Prisma `EventOutbox`, `prisma/schema.prisma:529-546`).
  - Created in migration `20260821135918_ledger_and_audit_tables` (L44).
  - The unpublished index was added in `20260917223405_fe_contract_support`.
  - Columns: `aggregate_type`, `aggregate_id`, `event_type`, `payload` (JSON), `published_at`, `attempts`, `last_error`.
- **Relay:** `src/infrastructure/messaging/outbox-relay.service.ts`, added in commit `3eb8587` (2026-08-24).
  - Polls every 1s (L10, L61), 50 per batch, `FOR UPDATE SKIP LOCKED` (L104) so replicas are safe.
  - Gives up after 10 attempts (L13). Delivery is at-least-once.
  - Its stats are on the health endpoint (`health.controller.ts:5,33`).
- **Final publisher:** `LoggingEventPublisher`, which only logs. Its docstring says "Stands in for BullMQ until the queue is wired" (`logging-event-publisher.ts:7-23`).
  - It sits at the end of a chain: Group, then walk-in, then waitlist listeners, then the logger (`persistence.module.ts:109-133`).
  - A push link would be one more element in that chain.
- **Writers:** about 33 `eventOutbox.create` calls, all inside the same transaction as the state change. Event types include:
  - `booking.confirmed`, `booking.cancelled`, `booking.no_show`, `booking.expired`, `booking.skipped`, `booking.rescheduled`, `booking.shortened`, `session.started`
  - `group.*`, `series.*`, `waitlist.offered`, `payment.*`, `reminder.payment_link`

---

## Built but NOT in this plan

**Push service**

- `GET /notifications/:id` status query (`notification.controller.ts:103-113`).
- BullMQ queue with temporary-vs-permanent FCM error handling (`fcm-push-sender.ts:10-17`, `send-notification.processor.ts:42-47`).
- `docker-stack.yml`, a Swarm stack for the push service. The plan says Compose.
- `web-test/`, a browser FCM test page.
- Unused code:
  - `DomainErrorFilter` (`domain-error.filter.ts`), which is never registered.
  - `LogPushSender` and `InMemoryNotificationRepository`, which aren't wired.
  - The Hello World `AppController`.

**customer-api**

- `NotificationPreference` model, plus `GET`/`PATCH /api/v1/notifications/preferences` with a `push` master switch.
  - Commits `3095e26` and `6203a1b`, migration `0013_notificationpreference`, test `apps/accounts/tests/test_notification_preferences.py`.
  - **Nothing reads these preferences before sending.**
- `Device` model and table `device` (migration `0007`), plus `push_token` on `/auth/me`. This is a second device registry that nothing writes to.

## Tests

| Repo | Tests for this work | Result |
|------|---------------------|--------|
| Push service | `yarn test`: 5 files, **17/17 pass**. `tsc --noEmit` exit 0. `yarn lint` exit 0. | Pass |
| | Coverage of the new work: **none.** No tests for `PUT /devices`, `/devices/unregister`, `/notifications/user`, `SendUserNotificationHandler`, `saveForUser` dedupe, `markInvalid` on dead tokens, or the device repository. `18b92db` only added a `devices` mock to the existing processor spec. | Gap |
| | `test/app.e2e-spec.ts` (Hello World only; needs Postgres, Redis and the Firebase file) | Not run (would run DDL) |
| customer-api | `test_notification_preferences.py` covers preferences, not Phase 4 | Not run (outside this plan) |
| booking-api | No push tests (nothing to test). The outbox has its own specs. | Not run |

## Risks and bugs (highest first)

| # | Sev | Where | What happens |
|---|-----|-------|--------------|
| R1 | High | `send-user-notification.handler.ts:40-52` | The row is inserted, then `queue.add` runs separately. If Redis fails in between, the row stays `PENDING` with no job. A retry with the same `eventId` is then deduped, so **the notification is never sent**. booking-api's planned retries make this path likely. |
| R2 | Med | `notification.controller.ts:56-66` | A whitespace-only `title` or `body` passes the DTO (`@IsString` only) but throws `DomainError` in `NotificationContent.create`. Unlike `send()` (L87-100), there's no catch, and `DomainErrorFilter` is never registered, so the caller gets **500, not 400**. It only happens when the user has at least one active device. |
| R3 | Med | `send-user-notification.dto.ts:32-34`, `send-notification.dto.ts:27-29` | `data` values aren't validated as strings. A number gets a 202, then FCM rejects it with `messaging/invalid-argument`, so the send is silently `FAILED`. |
| R4 | Low | `postgres-notification.repository.ts:38-42` | Dedupe is per device, so a replayed `eventId` reaches devices added after the first send. A send to a user with no devices leaves no record, so a later replay does send. |
| R5 | Med | Queue options; no cleanup jobs | `notifications`, `invalid` devices and every BullMQ job (no `removeOnComplete`) grow forever. Redis has no maxmemory or persistence config in compose. |
| R6 | Med | `docker-compose.yml:16-17,34-35` | Redis is published on the host (`6381`) **with no password**, and the app on `0.0.0.0`. If the firewall is open, anyone can read or inject jobs. Can't verify the firewall from code. |
| R7 | Med | Uncommitted `docker-compose.yml` | `NODE_ENV: development` overrides the Dockerfile's `production` and **exposes `/docs`** if it's committed or deployed. |
| R8 | Med | Both repositories' `onModuleInit` | DDL runs at boot instead of migrations. `CREATE TABLE IF NOT EXISTS` won't apply future column changes, and there's no record of what schema the server has. Every replica runs the DDL on start. |
| R9 | Low | `send-notification.processor.ts:49-57` | If `markInvalid` fails inside `catch`, the job throws. On the last attempt the notification stays `PENDING` forever. |
| R10 | Med | Phase 6 identity | The push `userId` must be customer-api's `consumer_id`. booking-api has only `customer_id`. It matches on the group path; the single-booking and staff-created paths are unverified. If they differ, sends find 0 devices silently. |
| R11 | Med | customer-api `Device` vs push `devices` | Two device registries. `/auth/me` returns a `push_token` from a table nothing writes to. Pick one before building Phase 4. |
| R12 | Low | `device.controller.ts:27-32` | Unregister takes only a token, so customer-api's `DELETE /me/device-tokens` can't scope deletion to the session user unless push accepts and checks `userId`. |
| R13 | Low | `postgres-device.repository.ts:44-55` | `PUT /devices` moves a token to whoever registers it. That's by design for re-login on a shared phone, but customer-api must only accept tokens from the authenticated device. |
| R14 | Low | `README.md` | Doesn't document `PUT /devices`, `/devices/unregister` or `/notifications/user`. L313 says "many devices at once is not implemented", which is now partly stale. |
| R15 | Low | `postgres-device.repository.ts:14-18`, `postgres-notification.repository.ts:13-17` | If `DATABASE_URL` is unset, the code silently falls back to a hard-coded localhost URL with default credentials. Two separate pools. |
| R16 | Low | `send-notification.processor.ts:14-17` | `messaging/mismatched-credential` (token from another Firebase project) isn't treated as dead, so those tokens fail forever. |
| R17 | Low | `docker-compose.yml:5`, `docker-stack.yml:5,26` | The Postgres password is a hard-coded default in committed files. The DB isn't port-published, which limits the exposure. |
