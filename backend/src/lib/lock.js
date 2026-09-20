/**
 * A one-at-a-time queue ("mutex").
 *
 * Chromium needs ~200-300 MB of RAM. Render's free tier has 512 MB, so we must never run
 * two browsers at once. Every browser job goes through `browserLock.run(...)`; extra jobs
 * simply wait their turn.
 */
export function createLock() {
  let tail = Promise.resolve();
  let waiting = 0;
  return {
    run(task) {
      waiting++;
      const result = tail.then(task, task);
      tail = result.catch(() => {}).finally(() => { waiting--; });
      return result;
    },
    get pending() {
      return waiting;
    },
  };
}

export const browserLock = createLock();
