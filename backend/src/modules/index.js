/**
 * THE LIST OF FEATURES.
 *
 * Every feature is a self-contained folder under src/modules/ that exports:
 *   { name, router?, onStart? }
 *     router  - an Express router, mounted under /api
 *     onStart - optional async function run once when the server boots
 *
 * To REMOVE a feature: delete its line below (and its folder).
 * To ADD a feature:    create src/modules/<name>/index.js with the same shape and add it here.
 *
 * Order matters only for onStart (e.g. checks registers its event listeners before
 * the catalog starts syncing).
 */
import health from './health/index.js';
import catalog from './catalog/index.js';
import tracking from './tracking/index.js';
import checks from './checks/index.js';
import scheduler from './scheduler/index.js';
import alerts from './alerts/index.js'; // optional: price-drop / back-in-stock alerts

export const modules = [health, checks, catalog, tracking, scheduler, alerts];
