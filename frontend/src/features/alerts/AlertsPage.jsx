/** Optional feature: in-app alerts for price drops and back-in-stock. */
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { usePolling } from '../../hooks/usePolling.js';
import { formatDateTime } from '../../utils/format.js';

const ICONS = { price_drop: '📉', back_in_stock: '📦' };

export default function AlertsPage() {
  const { data, error, reload } = usePolling(() => api.listAlerts(), 15000);
  const items = data?.items ?? [];

  return (
    <section>
      <div className="page-head">
        <h1>Alerts {data?.unreadCount ? <span className="badge badge-failed">{data.unreadCount} new</span> : null}</h1>
        {data?.unreadCount > 0 && <button className="btn" onClick={() => api.markAllAlertsRead().then(reload)}>Mark all read</button>}
      </div>
      {error && <p className="error">{error}</p>}
      {data && !items.length && <p className="muted">No alerts yet. You’ll see one here when a price drops or a product comes back in stock.</p>}
      <ul className="alert-list">
        {items.map((a) => (
          <li key={a.id} className={a.readAt ? 'alert' : 'alert unread'}>
            <span className="alert-icon">{ICONS[a.type] ?? '🔔'}</span>
            <div>
              <div><Link to={`/products/${a.trackedProductId}`}>{a.productName}</Link> — {a.message}</div>
              <div className="muted small">{formatDateTime(a.createdAt)}</div>
            </div>
            {!a.readAt && <button className="btn btn-sm" onClick={() => api.markAlertRead(a.id).then(reload)}>Mark read</button>}
          </li>
        ))}
      </ul>
    </section>
  );
}
