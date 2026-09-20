/**
 * Every call to the backend goes through this file.
 * The backend URL comes from VITE_API_URL (set it in Vercel's project settings).
 */
const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');

// Render's free server sleeps when idle; the first request can take ~1 minute to wake it.
// Components can subscribe to know when a request is slow (see ServerWakeBanner).
const slowListeners = new Set();
let slowRequests = 0;
const notifySlow = () => slowListeners.forEach((fn) => fn(slowRequests > 0));
export function onSlowRequests(fn) {
  slowListeners.add(fn);
  return () => slowListeners.delete(fn);
}

async function request(method, path, body) {
  let wasSlow = false;
  const slowTimer = setTimeout(() => { wasSlow = true; slowRequests++; notifySlow(); }, 4000);
  try {
    const response = await fetch(BASE_URL + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(90_000),
    });
    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  } finally {
    clearTimeout(slowTimer);
    if (wasSlow) { slowRequests--; notifySlow(); }
  }
}

export const api = {
  // catalog
  searchCatalog: (q) => request('GET', `/api/catalog/search?q=${encodeURIComponent(q)}&limit=20`),
  catalogStatus: () => request('GET', '/api/catalog/status'),
  syncCatalog: () => request('POST', '/api/catalog/sync'),
  // tracking
  listTracked: () => request('GET', '/api/tracked'),
  getTracked: (id) => request('GET', `/api/tracked/${id}`),
  track: (storeProductId) => request('POST', '/api/tracked', { storeProductId }),
  updateTracked: (id, changes) => request('PATCH', `/api/tracked/${id}`, changes),
  untrack: (id) => request('DELETE', `/api/tracked/${id}`),
  history: (id) => request('GET', `/api/tracked/${id}/history?limit=1000`),
  // checks
  checkNow: (id) => request('POST', `/api/tracked/${id}/check`),
  listChecks: (trackedId) => request('GET', `/api/checks?limit=200${trackedId ? `&trackedId=${trackedId}` : ''}`),
  schedulerStatus: () => request('GET', '/api/scheduler/status'),
  // alerts
  listAlerts: () => request('GET', '/api/alerts?limit=100'),
  markAlertRead: (id) => request('POST', `/api/alerts/${id}/read`),
  markAllAlertsRead: () => request('POST', '/api/alerts/read-all'),
};
