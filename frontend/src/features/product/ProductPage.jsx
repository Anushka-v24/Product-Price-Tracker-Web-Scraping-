/** One tracked product: price chart, history table, check log, and settings. */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { usePolling } from '../../hooks/usePolling.js';
import { PriceChart } from '../../components/PriceChart.jsx';
import { StatusBadge, StockBadge } from '../../components/StatusBadge.jsx';
import { CheckLogTable } from '../checks/CheckLogTable.jsx';
import { formatPrice, formatDateTime, timeAgo } from '../../utils/format.js';

const INTERVALS = [15, 30, 60, 120, 240, 360, 720, 1440];

export default function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState(null);
  const [view, setView] = useState('chart');

  // Messages like "Interval updated" show as a small toast and disappear after 3 s.
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  // Poll faster while a check is running so the result appears quickly.
  const product = usePolling(() => api.getTracked(id), 5000, [id]);
  const history = usePolling(() => api.history(id), 10000, [id]);
  const checks = usePolling(() => api.listChecks(id), 5000, [id]);

  const t = product.data;
  const running = checks.data?.items?.some((c) => c.status === 'running');

  async function act(fn, success) {
    try {
      await fn();
      setMessage(success);
      product.reload(); checks.reload(); history.reload();
    } catch (e) {
      setMessage(`Error: ${e.message}`);
    }
  }

  if (product.error) return <p className="error">{product.error}</p>;
  if (!t) return <p className="muted">Loading…</p>;

  return (
    <section>
      <div className="page-head compact">
        <div>
          <h1>{t.name}</h1>
          <p className="muted">{t.brand} · {t.category} · SKU {t.sku} · store id {t.storeProductId}</p>
        </div>
        <div className="actions">
          <button className="btn btn-primary" disabled={running} onClick={() => act(() => api.checkNow(t.id), 'Check started…')}>
            {running ? 'Checking…' : 'Check now'}
          </button>
          <button className="btn btn-danger" onClick={() => {
            if (window.confirm('Stop tracking and delete this product’s history?')) {
              api.untrack(t.id).then(() => navigate('/')).catch((e) => setMessage(`Error: ${e.message}`));
            }
          }}>Stop tracking</button>
        </div>
      </div>
      {message && <div className="toast">{message}</div>}

      <div className="stats compact">
        <div className="stat"><div className="stat-label">Current price</div><div className="stat-value">{formatPrice(t.latestPrice)}</div>
          {t.latestMrp && <div className="muted small">MRP <span className="strike">{formatPrice(t.latestMrp)}</span></div>}</div>
        <div className="stat"><div className="stat-label">Stock</div><div className="stat-value"><StockBadge inStock={t.latestInStock} quantity={t.latestStockQuantity} /></div></div>
        <div className="stat"><div className="stat-label">Last check</div><div className="stat-value"><StatusBadge status={t.lastRunStatus} /></div>
          <div className="muted small">{timeAgo(t.lastCheckedAt)}</div></div>
        <div className="stat"><div className="stat-label">Next check</div>
          <div className="stat-value small">{nextCheckText(t, running)}</div>
          <div className="muted small">
            {!t.isActive ? 'Automatic checks are off' : isOverdue(t) && !running ? 'Waiting for the scheduler to run it' : formatDateTime(t.nextCheckAt)}
          </div></div>
      </div>

      <div className="settings">
        <label>
          Check every{' '}
          <select value={t.checkIntervalMinutes} onChange={(e) => act(() => api.updateTracked(t.id, { checkIntervalMinutes: Number(e.target.value) }), 'Interval updated')}>
            {[...new Set([...INTERVALS, t.checkIntervalMinutes])].sort((a, b) => a - b).map((m) => (
              <option key={m} value={m}>{m < 60 ? `${m} minutes` : `${m / 60} hour${m === 60 ? '' : 's'}`}</option>
            ))}
          </select>
        </label>
        <label>
          <input type="checkbox" checked={t.isActive} onChange={(e) => act(() => api.updateTracked(t.id, { isActive: e.target.checked }), e.target.checked ? 'Resumed' : 'Paused')} />
          {' '}Automatic checks on
        </label>
      </div>

      <h2>Price &amp; stock history</h2>
      <div className="tabs">
        <button className={view === 'chart' ? 'tab active' : 'tab'} onClick={() => setView('chart')}>Chart</button>
        <button className={view === 'table' ? 'tab active' : 'tab'} onClick={() => setView('table')}>Table</button>
      </div>
      {view === 'chart' ? <PriceChart points={history.data?.items} /> : <HistoryTable points={history.data?.items ?? []} />}

      <h2>Check log</h2>
      <CheckLogTable runs={checks.data?.items ?? []} />
    </section>
  );
}

const isOverdue = (t) => new Date(t.nextCheckAt).getTime() <= Date.now();

/** "in 12 min", "Checking now…", "Due now" or "Paused" - never a time in the past. */
function nextCheckText(t, running) {
  if (!t.isActive) return 'Paused';
  if (running) return 'Checking now…';
  if (isOverdue(t)) return 'Due now';
  return timeAgo(t.nextCheckAt);
}

function HistoryTable({ points }) {
  if (!points.length) return <p className="muted">No data yet.</p>;
  return (
    <table className="table">
      <thead><tr><th>Checked at</th><th>Price</th><th>MRP</th><th>Stock</th><th>Change</th></tr></thead>
      <tbody>
        {[...points].reverse().map((p, i, arr) => {
          const prev = arr[i + 1];
          const diff = prev ? p.price - prev.price : 0;
          return (
            <tr key={p.id}>
              <td>{formatDateTime(p.capturedAt)}</td>
              <td>{formatPrice(p.price, p.currency)}</td>
              <td>{formatPrice(p.mrp)}</td>
              <td><StockBadge inStock={p.inStock} quantity={p.stockQuantity} /></td>
              <td className={diff < 0 ? 'down' : diff > 0 ? 'up' : 'muted'}>{diff === 0 ? '—' : `${diff > 0 ? '+' : ''}${formatPrice(diff)}`}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
