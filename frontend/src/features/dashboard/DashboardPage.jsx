/** Overview across all tracked products: KPI tiles, product cards with trends, recent checks. */
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { usePolling } from '../../hooks/usePolling.js';
import { StatusBadge, StockBadge } from '../../components/StatusBadge.jsx';
import { Sparkline } from '../../components/Sparkline.jsx';
import { RingGauge } from '../../components/RingGauge.jsx';
import { Icon } from '../../components/Icons.jsx';
import { formatPrice, timeAgo, formatInterval } from '../../utils/format.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export default function DashboardPage() {
  const tracked = usePolling(() => api.listTracked(), 15000);
  const checks = usePolling(() => api.listChecks(), 15000);
  const alerts = usePolling(() => api.listAlerts().catch(() => null), 30000);

  const items = tracked.data?.items ?? [];
  const runs = checks.data?.items ?? [];

  // KPIs
  const withData = items.filter((t) => t.latestInStock != null);
  const inStock = withData.filter((t) => t.latestInStock).length;
  const recent = runs.filter((r) => r.status !== 'running' && Date.now() - new Date(r.startedAt).getTime() < DAY_MS);
  const ok = recent.filter((r) => r.status === 'success' || r.status === 'retried').length;
  const successRate = recent.length ? Math.round((ok / recent.length) * 100) : null;

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">Price and stock of every tracked product on the INE store.</p>
        </div>
      </div>
      {tracked.error && <p className="error">{tracked.error}</p>}

      <div className="kpis">
        <Kpi tone="blue" icon="box" label="Tracked products" value={items.length}
          sub={`${items.filter((t) => t.isActive).length} with automatic checks`} />
        <Kpi tone="cyan" icon="check" label="In stock" value={withData.length ? `${inStock}/${withData.length}` : '—'}
          sub={withData.length ? `${withData.length - inStock} out of stock` : 'no data yet'} />
        <div className="kpi tone-green">
          <div className="kpi-body">
            <div className="kpi-label"><Icon name="pulse" size={15} /> Success · 24h</div>
            <div className="kpi-value">{successRate == null ? '—' : `${successRate}%`}</div>
            <div className="kpi-sub">{recent.length} checks · {recent.length - ok} failed</div>
          </div>
          <RingGauge value={successRate} />
        </div>
        <Kpi tone="pink" icon="bell" label="New alerts" value={alerts.data?.unreadCount ?? 0}
          sub={<Link to="/alerts">View alerts →</Link>} />
      </div>

      {tracked.loading && !tracked.data && <p className="muted">Loading…</p>}
      {tracked.data && !items.length && (
        <div className="empty panel">
          <p>You’re not tracking anything yet.</p>
          <Link className="btn btn-primary" to="/search">Find a product</Link>
        </div>
      )}

      <div className="cards">
        {items.map((t) => <ProductCard key={t.id} t={t} />)}
      </div>
    </section>
  );
}

function Kpi({ tone, icon, label, value, sub }) {
  return (
    <div className={`kpi tone-${tone}`}>
      <div className="kpi-body">
        <div className="kpi-label"><Icon name={icon} size={15} /> {label}</div>
        <div className="kpi-value">{value}</div>
        <div className="kpi-sub">{sub}</div>
      </div>
    </div>
  );
}

function ProductCard({ t }) {
  const history = usePolling(() => api.history(t.id), 60000, [t.id]);
  const prices = (history.data?.items ?? []).map((p) => p.price);
  const first = prices[0], last = prices[prices.length - 1];
  const change = prices.length > 1 ? ((last - first) / first) * 100 : null;
  const discount = t.latestMrp && t.latestPrice && t.latestMrp > t.latestPrice
    ? Math.round((1 - t.latestPrice / t.latestMrp) * 100) : null;

  return (
    <Link to={`/products/${t.id}`} className="card">
      <div className="card-top">
        <div>
          <div className="card-title">{t.name}</div>
          <div className="muted small">{t.category} · SKU {t.sku}</div>
        </div>
        <StatusBadge status={t.lastRunStatus} title={t.lastRunErrorCode ?? ''} />
      </div>
      <div className="card-price-row">
        <span className="card-price">{formatPrice(t.latestPrice, t.latestCurrency ?? 'INR')}</span>
        {change != null && (
          <span className={change < 0 ? 'delta down' : change > 0 ? 'delta up' : 'delta'}>
            {change > 0 ? '▲' : change < 0 ? '▼' : '•'} {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="muted small">
        {t.latestMrp ? <>MRP <span className="strike">{formatPrice(t.latestMrp)}</span></> : ' '}
        {discount ? <span className="discount"> {discount}% off</span> : null}
      </div>
      <Sparkline values={prices} />
      <div className="card-foot">
        <StockBadge inStock={t.latestInStock} quantity={t.latestStockQuantity} />
        <span className="muted small">
          {timeAgo(t.lastCheckedAt)} · {t.isActive ? formatInterval(t.checkIntervalMinutes) : 'paused'}
        </span>
      </div>
      {t.lastRunErrorCode === 'LAYOUT_CHANGED' && (
        <div className="warn small">⚠ The store’s page layout seems to have changed</div>
      )}
    </Link>
  );
}
