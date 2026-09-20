/**
 * Tracking feature: which products the user follows, and how often they are checked.
 *
 * When a product is added we emit 'tracked.created'. The checks module listens and runs the
 * first check straight away - this module doesn't need to know how checks work.
 */
import * as repo from './tracking.repository.js';
import { ensureProduct } from '../catalog/catalog.service.js';
import { config } from '../../config/env.js';
import { events } from '../../lib/events.js';
import { HttpError } from '../../lib/errors.js';

export const list = () => repo.list();

export async function get(id) {
  const tracked = await repo.getById(id);
  if (!tracked) throw new HttpError(404, `Tracked product ${id} not found`);
  return tracked;
}

export async function track({ storeProductId, checkIntervalMinutes }) {
  const interval = validateInterval(checkIntervalMinutes ?? config.scheduler.defaultIntervalMinutes);
  await ensureProduct(storeProductId); // 404 if the store has no such product

  if (await repo.getByStoreProductId(storeProductId)) {
    throw new HttpError(409, 'This product is already being tracked');
  }
  const created = await repo.create({ storeProductId, checkIntervalMinutes: interval });
  events.emitSafe('tracked.created', { tracked: created });
  return get(created.id);
}

export async function update(id, { checkIntervalMinutes, isActive }) {
  const changes = {};
  if (checkIntervalMinutes !== undefined) changes.checkIntervalMinutes = validateInterval(checkIntervalMinutes);
  if (isActive !== undefined) {
    if (typeof isActive !== 'boolean') throw new HttpError(400, '"isActive" must be true or false');
    changes.isActive = isActive;
  }
  const updated = await repo.update(id, changes);
  if (!updated) throw new HttpError(404, `Tracked product ${id} not found`);
  return updated;
}

export async function untrack(id) {
  if (!(await repo.remove(id))) throw new HttpError(404, `Tracked product ${id} not found`);
}

export async function history(id, limit) {
  await get(id);
  return repo.history(id, limit);
}

function validateInterval(value) {
  const n = Number(value);
  const min = config.scheduler.minIntervalMinutes;
  if (!Number.isInteger(n) || n < min || n > 7 * 24 * 60) {
    throw new HttpError(400, `Check interval must be a whole number of minutes between ${min} and 10080 (7 days)`);
  }
  return n;
}
