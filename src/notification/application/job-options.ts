import type { JobsOptions } from 'bullmq';

/**
 * How every push job is kept in Redis.
 *
 * Three tries, a second apart and doubling, as before. What is new is that
 * a job does not stay in Redis for ever once it is done: Postgres holds the
 * record of every notification, so Redis only needs a job while it is
 * running. Done jobs go after an hour (at most the last 1000), failed ones
 * after a week, which is long enough to look at them.
 *
 * Safe with a jobId re-added later: the processor skips a notification that
 * is no longer PENDING, so a job added again after the first one was cleared
 * cannot send twice.
 */
export const PUSH_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: { age: 60 * 60, count: 1000 },
  removeOnFail: { age: 7 * 24 * 60 * 60 },
};
