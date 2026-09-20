/**
 * Alerts feature (optional). It only LISTENS to 'check.succeeded' events, so nothing else in
 * the app depends on it: removing this folder and its line in modules/index.js disables alerts.
 */
import * as repo from './alerts.repository.js';
import { alertsFor } from './alerts.rules.js';
import { events } from '../../lib/events.js';
import { logger } from '../../lib/logger.js';

export function onStart() {
  events.on('check.succeeded', async ({ tracked, previous, current }) => {
    for (const alert of alertsFor({ previous, current })) {
      await repo.create({ trackedProductId: tracked.id, ...alert });
      logger.info('alert raised', { trackedId: tracked.id, type: alert.type });
    }
  });
}

export const list = (options) => repo.list(options);
export const unreadCount = () => repo.unreadCount();
export const markRead = (id) => repo.markRead(id);
export const markAllRead = () => repo.markAllRead();
