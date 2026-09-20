import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withRetry } from '../src/lib/retry.js';
import { RetryableError, FatalError } from '../src/lib/errors.js';
import { createLock } from '../src/lib/lock.js';

test('retries temporary errors and then succeeds', async () => {
  let calls = 0;
  const result = await withRetry(
    async () => {
      calls++;
      if (calls < 3) throw new RetryableError('503');
      return 'ok';
    },
    { attempts: 5, baseDelayMs: 1 },
  );
  assert.equal(result, 'ok');
  assert.equal(calls, 3);
});

test('does not retry fatal errors', async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(async () => {
      calls++;
      throw new FatalError('404');
    }, { attempts: 5, baseDelayMs: 1 }),
    FatalError,
  );
  assert.equal(calls, 1);
});

test('gives up after the attempt limit', async () => {
  let calls = 0;
  await assert.rejects(withRetry(async () => { calls++; throw new RetryableError('down'); }, { attempts: 3, baseDelayMs: 1 }));
  assert.equal(calls, 3);
});

test('lock runs jobs one at a time', async () => {
  const lock = createLock();
  let running = 0, maxRunning = 0;
  const job = () => lock.run(async () => {
    running++; maxRunning = Math.max(maxRunning, running);
    await new Promise((r) => setTimeout(r, 10));
    running--;
  });
  await Promise.all([job(), job(), job()]);
  assert.equal(maxRunning, 1);
});
