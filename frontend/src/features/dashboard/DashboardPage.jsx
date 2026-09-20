/** All tracked products at a glance: latest price, stock, and whether the last check worked. */
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { usePolling } from '../../hooks/usePolling.js';
import { StatusBadge, StockBadge } from '../../components/StatusBadge.jsx';
import { formatPrice, timeAgo, formatInterval } from '../../utils/format.js';

export default function DashboardPage() {
  const { data, error, loading } = usePolling(() => api.listTracked(), 15000);
  const items = data?.items ?? [];

  return (
    <section>
      <div className="page-head">
        <h1>Tracked products</h1>
        <Link className="btn btn-primary" to="/search">+ Track a product</Link>
      </div>
      {error && <p className="error">{error}</p>}
      {loading && !data && <p className="muted">Loading…</p>}
      {data && !items.length && (
        <div className="empty">
          <p>You’re not tracking anything yet.</p>
          <Link className="btn btn-primary" to="/search">Find a product</Link>
        </div>
      )}
      <div className="cards">
        {items.map((t) => (
          <Link key={t.id} to={`/products/${t.id}`} className="card">
            <div className="card-title">{t.name}</div>
            <div className="muted small">SKU {t.sku}</div>
            <div className="card-price">{formatPrice(t.latestPrice, t.latestCurrency ?? 'INR')}</div>
            {t.latestMrp && t.latestMrp > t.latestPrice && <div className="muted small strike">{formatPrice(t.latestMrp)}</div>}
            <div className="card-row">
              <StockBadge inStock={t.latestInStock} quantity={t.latestStockQuantity} />
              <StatusBadge status={t.lastRunStatus} title={t.lastRunErrorCode ?? ''} />
            </div>
            <div className="muted small">
              Checked {timeAgo(t.lastCheckedAt)} · {t.isActive ? `${formatInterval(t.checkIntervalMinutes)}` : 'paused'}
            </div>
            {t.lastRunErrorCode === 'LAYOUT_CHANGED' && (
              <div className="warn small">⚠ The store’s page layout seems to have changed</div>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
