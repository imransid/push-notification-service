# Queue tidy-up: what changed and how to deploy

Branch `fix/queue-tidy`. No database change, no new package.

## What changed

1. **Done jobs leave Redis.** Every push job used to stay in Redis for
   ever, so Redis only grew. Now a finished job is removed after an hour
   (the last 1000 at most) and a failed one after a week
   (`src/notification/application/job-options.ts`). Postgres still keeps
   every notification, so nothing is lost. A job added again with the same
   id cannot send twice: the processor skips a notification that is no
   longer PENDING.
2. **The API key is compared in constant time** (`api-key.guard.ts`). A
   plain `!==` stops at the first wrong character, and the time it takes
   tells a caller how much of a guess was right.
3. **Redis can have a password**, optional. Set `REDIS_PASSWORD` and the
   app uses it; unset, no password, as before.

## Deploy (docker compose on the server)

Find the folder the running service was started from:

```sh
docker inspect $(docker ps -qf name=push | head -1) --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}'
```

Then in that folder:

```sh
git pull && git log --oneline -1
docker compose up -d --build app
docker compose ps
```

Check: a push still goes out (log in on a phone, or any booking push), and
in a minute or two `docker compose exec redis redis-cli --scan --pattern 'bull:notifications:*' | wc -l`
stays small instead of growing.

## Later, optional: a Redis password

Redis is not published to the internet (no `ports:` on it), so this is
extra safety, not a fix. When wanted, together and in one go:

1. Pick a password and add `REDIS_PASSWORD=<it>` to the `.env` beside
   `docker-compose.yml`.
2. On the `redis` service add
   `command: ["redis-server", "--appendonly", "yes", "--requirepass", "${REDIS_PASSWORD}"]`,
   and pass `REDIS_PASSWORD: ${REDIS_PASSWORD}` to `app`.
3. `docker compose up -d`.
