# Push Notification Service

A NestJS service that sends push notifications through **Firebase Cloud Messaging (FCM)** and tracks their delivery status. It is built with **CQRS** and **DDD**, and sends in the background through a **BullMQ** queue.

## Features

- Send a push to a device token and look up its status later
- `POST` answers immediately with `202 Accepted`. A background worker sends the push
- Temporary FCM errors are retried automatically (3 attempts, exponential backoff). Invalid tokens are not retried
- Notifications are stored in PostgreSQL, so they survive restarts
- API key protection, request validation (DTO) and business-rule validation (domain)
- Interactive Swagger docs
- Runs locally, in Docker Compose, or as a Docker Swarm stack

## Tech stack

| Area            | Tool                                           |
| --------------- | ---------------------------------------------- |
| Framework       | NestJS 11, TypeScript (CommonJS)               |
| Architecture    | `@nestjs/cqrs`, DDD layers, ports and adapters |
| Queue           | BullMQ with Redis (`ioredis`)                  |
| Database        | PostgreSQL (`pg`)                              |
| Push            | `firebase-admin` (FCM)                         |
| API docs        | `@nestjs/swagger`                              |
| Validation      | `class-validator`, `class-transformer`         |
| Tests           | Vitest                                         |
| Package manager | Yarn 4 (`nodeLinker: node-modules`)            |
| Runtime         | Node.js 22                                     |

## How it works

```
POST /notifications
  -> ApiKeyGuard -> ValidationPipe (DTO) -> Controller
  -> SendNotificationCommand -> SendNotificationHandler
       - builds the Notification aggregate (domain rules run here)
       - saves it as PENDING in Postgres
       - adds a job to the Redis queue
  <- 202 { "id": "..." }

Worker (SendNotificationProcessor)
  - loads the notification, skips it unless it is PENDING
  - sends through FCM
  - marks it SENT or FAILED, saves it, publishes events

GET /notifications/:id
  -> GetNotificationQuery -> repository -> status
```

### Project structure

```
src/
  main.ts                         App bootstrap, validation pipe, Swagger
  app.module.ts                   Root module, loads .env
  notification/
    domain/                       Business rules. No Nest, no database
      notification.aggregate.ts   Notification (PENDING -> SENT or FAILED)
      value-objects/              DeviceToken, NotificationContent
      events/                     Created, Sent, Failed events
      domain.error.ts             Rule violations (become HTTP 400)
      temporary-push.error.ts     Errors that are worth retrying
      notification.repository.ts  Port (interface)
      push-sender.port.ts         Port (interface)
    application/                  Use cases
      commands/                   SendNotification command and handler
      queries/                    GetNotification query and handler
      event-handlers/             Log Sent and Failed events
      send-notification.processor.ts   Queue worker
    infrastructure/               Real tools (adapters)
      fcm-push-sender.ts          Sends through Firebase
      postgres-notification.repository.ts
      in-memory-notification.repository.ts   For quick experiments
      log-push-sender.ts          Fake sender that only logs
    presentation/                 HTTP layer
      notification.controller.ts
      send-notification.dto.ts
      notification.responses.ts   Swagger response shapes
      api-key.guard.ts
    notification.module.ts        Wires everything together
test/unit/                        Unit tests
web-test/                         Small page that prints a real FCM token
```

Why this layout: the domain knows nothing about Firebase or Postgres. To change a provider, write a new class in `infrastructure/` and change one `provide` line in `notification.module.ts`.

## Requirements

- Node.js 22
- Yarn 4 (`corepack enable`)
- Docker (for PostgreSQL and Redis)
- A Firebase project with a service account key

## Setup

### 1. Install

```bash
corepack enable
yarn install
```

### 2. Firebase service account key

1. Firebase Console, then Project settings, then **Service accounts**, then **Generate new private key**.
2. Save the file in the project root as `firebase-service-account.json`.

This file gives full access to your Firebase project. It is already in `.gitignore`. Never commit it, share it, or paste it anywhere. If it leaks, delete the key in Google Cloud (IAM & Admin, Service Accounts, Keys) and generate a new one.

### 3. Start PostgreSQL and Redis

```bash
docker run --name push-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=push \
  -p 5434:5432 -v push-pgdata:/var/lib/postgresql/data -d postgres:16

docker run --name push-redis -p 6381:6379 -d redis:7-alpine
```

The ports (5434 and 6381) avoid clashes with other databases on your machine. The `notifications` table is created automatically on startup.

### 4. Environment variables

Create a `.env` file (it is git-ignored):

```bash
PORT=3351
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:543/push
REDIS_HOST=127.0.0.1
REDIS_PORT=6381
FIREBASE_KEY_PATH=firebase-service-account.json
API_KEY=<a long random string>
```

Generate an API key with:

```bash
openssl rand -hex 32
```

| Variable            | Description                             | Default in code                                    |
| ------------------- | --------------------------------------- | -------------------------------------------------- |
| `PORT`              | HTTP port                               | `3000`                                             |
| `DATABASE_URL`      | PostgreSQL connection string            | `postgres://postgres:postgres@127.0.0.1:5434/push` |
| `REDIS_HOST`        | Redis host                              | `127.0.0.1`                                        |
| `REDIS_PORT`        | Redis port                              | `6381`                                             |
| `FIREBASE_KEY_PATH` | Path to the service account JSON        | `firebase-service-account.json`                    |
| `API_KEY`           | Secret that clients send in `x-api-key` | none, so every request gets `401` without it       |
| `NODE_ENV`          | Set to `production` to disable Swagger  | unset                                              |

### 5. Run

```bash
yarn start:dev
```

## API

All endpoints need the header `x-api-key: <API_KEY>`.

Interactive docs: **http://localhost:3351/docs** (click **Authorize** and paste your key). The raw OpenAPI spec is at `/docs-json`. Swagger is disabled when `NODE_ENV=production`.

### `POST /notifications`

Saves the notification as `PENDING`, queues it, and returns at once.

```bash
curl -X POST http://localhost:3351/notifications \
  -H 'Content-Type: application/json' \
  -H "x-api-key: $API_KEY" \
  -d '{
    "deviceToken": "<fcm registration token>",
    "title": "Order shipped",
    "body": "Your order #1234 is on its way",
    "data": { "orderId": "1234" }
  }'
```

Response `202 Accepted`:

```json
{ "id": "73367643-d868-4bb4-abea-51583fd5d9f9" }
```

| Field         | Type             | Rules                                        |
| ------------- | ---------------- | -------------------------------------------- |
| `deviceToken` | string           | at least 10 characters                       |
| `title`       | string           | not empty                                    |
| `body`        | string           | not empty                                    |
| `data`        | object, optional | all values must be strings (FCM requirement) |

`202` means accepted, not delivered. Check the status with `GET`.

### `GET /notifications/:id`

```bash
curl -H "x-api-key: $API_KEY" http://localhost:3351/notifications/<id>
```

```json
{
  "id": "73367643-d868-4bb4-abea-51583fd5d9f9",
  "title": "Order shipped",
  "body": "Your order #1234 is on its way",
  "status": "SENT",
  "failureReason": null,
  "createdAt": "2026-10-03T09:28:27.337Z"
}
```

### Statuses

| Status    | Meaning                                                 |
| --------- | ------------------------------------------------------- |
| `PENDING` | Saved and queued, not sent yet (or waiting for a retry) |
| `SENT`    | FCM accepted the message                                |
| `FAILED`  | Rejected, or all retries used. `failureReason` says why |

### Errors

| Code  | When                                   | `message`                                 |
| ----- | -------------------------------------- | ----------------------------------------- |
| `400` | Wrong data type or missing field (DTO) | a list, e.g. `["title must be a string"]` |
| `400` | Business rule broken (domain)          | a string, e.g. `"Invalid device token"`   |
| `401` | Missing or wrong API key               | `"Invalid API key"`                       |
| `404` | Unknown notification id                | `"Notification not found"`                |

The shape of the message (list or string) tells you which layer rejected the request.

## Retries

The queue job is created with `attempts: 3` and exponential `backoff` starting at 1 second.

- **Temporary errors** (`messaging/internal-error`, `server-unavailable`, rate limits, network errors) are thrown as `TemporaryPushError`. The notification stays `PENDING` and BullMQ retries it. The retry is stored in Redis, so it survives a restart.
- **Permanent errors** (invalid or expired token) are saved as `FAILED` immediately.
- After the last failed attempt, the notification is saved as `FAILED`.
- The worker only sends notifications that are still `PENDING`, so a job that runs twice cannot send the same push twice.

## Testing with a real device token

A push needs a real token from an app registered in your Firebase project. The `web-test/` folder has a small page that prints one:

1. In Firebase, register a **Web app** and copy its `firebaseConfig` values.
2. Under **Cloud Messaging, Web Push certificates**, generate a key pair (the VAPID key).
3. Put those values into `web-test/index.html` and `web-test/firebase-messaging-sw.js`.
4. Serve the page:

```bash
   python3 -m http.server 5500 --directory web-test
```

5. Open http://localhost:5500, click **Get token**, and allow notifications. Use the printed token in the `POST` request.

Tokens expire. If a push ends as `FAILED` with "not a valid FCM registration token", get a new one.

## Tests

```bash
yarn vitest run test/unit
```

The unit tests cover the domain rules, the DTO validation, the command handler, and the worker (success, failure, retries, and no double sending). They need no database, Redis, or Firebase.

## Docker

### Docker Swarm (single machine or cluster)

The stack file `docker-stack.yml` runs the app, PostgreSQL and Redis. The Firebase key is stored as a Docker secret.

```bash
docker swarm init
docker build -t push-notification-service:latest .
docker secret create firebase_key firebase-service-account.json

export API_KEY=$(grep '^API_KEY=' .env | cut -d= -f2)
docker stack deploy -c docker-stack.yml push

docker stack services push          # wait for 1/1 on every service
docker service scale push_app=3     # run 3 copies, all sharing one queue
```

Notes:

- Free port 3351 first (stop `yarn start:dev` and `docker compose`).
- The first start can be slow while images download. If `push_db` stays in `Preparing`, run `docker pull postgres:16` and `docker service update --force push_db`.
- Until the database is up, the app restarts by itself and then settles.
- With several machines, push the image to a registry so every machine can pull it.
- The stack uses the `NODE_ENV=production` image setting, so Swagger is off there.

Remove it with:

```bash
docker stack rm push
docker secret rm firebase_key
```

### Test

```
python3 -m http.server 5500 --directory web-test
```

### Docker Compose

`docker-compose.yml` starts the app and PostgreSQL. It does **not** include Redis yet, so the queue will not work until you add a `redis` service and set `REDIS_HOST=redis`. Use the Swarm stack or the local setup above for now.

## Security notes

- Keep `.env` and `firebase-service-account.json` out of git. `.gitignore` and `.dockerignore` already exclude them.
- Use a long random `API_KEY`, and rotate it if it is ever shown anywhere.
- In Swarm, `API_KEY` is visible in `docker service inspect`. Only the Firebase key is a proper secret.
- The default database password (`postgres`) is for local development only.
- The Firebase web config and VAPID key in `web-test/` are public values meant for browsers.

## Known limitations and ideas

- Docker Compose has no Redis service yet
- No rate limiting on the API
- No dashboard for the queue (Bull Board would add one)
- Sending to topics or many devices at once is not implemented
- The `@nestjs/observe` telemetry package logs errors until you add its keys. They do not affect sending
- Retries are covered by unit tests but not by a test against a real FCM outage

```1. One-sentence description
2. Does HTTP call it?        → DTO + controller method
3. Does it change data?      → Command + Handler (else Query + Handler)
4. Does it need new SQL?     → Repository method (new table → new repository)
5. Is it slow or can it fail? → Queue + Processor
6. New business rule?        → Domain
7. Register in the module
8. Build bottom-up, run tsc after each step, then curl test
```

### Daily cleanup

`scripts/cleanup.sql` removes dead devices (status `invalid` or silent for 60 days)
and notifications older than 90 days. On the server it runs from root's crontab
at 22:15 UTC and appends its results to `/root/push-cleanup.log`.
