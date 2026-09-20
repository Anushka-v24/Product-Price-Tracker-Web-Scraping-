/**
 * In-process event bus. Modules talk to each other through events instead of
 * importing each other, so an optional feature (like alerts) can be deleted
 * without touching the code that emits the event.
 *
 * Events used today:
 *   'check.succeeded'  { tracked, previous, current }   (emitted by the checks module)
 *   'check.failed'     { tracked, run }
 */
import { EventEmitter } from 'node:events';
import { logger } from './logger.js';

class SafeEmitter extends EventEmitter {
  /** Like emit(), but a crashing listener is logged instead of breaking the caller. */
  emitSafe(event, payload) {
    for (const listener of this.listeners(event)) {
      Promise.resolve()
        .then(() => listener(payload))
        .catch((error) => logger.error(`listener for "${event}" failed`, { error: error.message }));
    }
  }
}

export const events = new SafeEmitter();
