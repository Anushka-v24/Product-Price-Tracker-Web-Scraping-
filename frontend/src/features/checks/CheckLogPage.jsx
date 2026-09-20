/** Check log for all products + what the scheduler will do next. */
import { api } from '../../api/client.js';
import { usePolling } from '../../hooks/usePolling.js';
import { CheckLogTable } from './CheckLogTable.jsx';
import { formatDateTime, timeAgo } from '../../utils/format.js';

export default function CheckLogPage() {
  const checks = usePolling(() => api.listChecks(), 10000);
  const scheduler = usePolling(() => api.schedulerStatus(), 30000);
  const runs = checks.data?.items ?? [];
  const count = (s) => runs.filter((r) => r.status === s).length;

  return (
    <section>
      <h1>Check log</h1>
      {checks.error && <p className="error">{checks.error}</p>}
      <div className="stats">
        <div className="stat"><div className="stat-label">Success</div><div className="stat-value">{count('success')}</div></div>
        <div className="stat"><div className="stat-label">Retried</div><div className="stat-value">{count('retried')}</div></div>
        <div className="stat"><div className="stat-label">Failed</div><div className="stat-value">{count('failed')}</div></div>
        <div className="stat"><div className="stat-label">Last scheduler call</div>
          <div className="stat-value small">{scheduler.data?.lastRun?.at ? timeAgo(scheduler.data.lastRun.at) : 'none since server start'}</div></div>
      </div>
      {scheduler.data?.upcoming?.length > 0 && (
        <p className="muted small">
          Next up: {scheduler.data.upcoming.slice(0, 3).map((u) => `${u.name} (${formatDateTime(u.nextCheckAt)})`).join(' · ')}
        </p>
      )}
      <CheckLogTable runs={runs} showProduct />
    </section>
  );
}
