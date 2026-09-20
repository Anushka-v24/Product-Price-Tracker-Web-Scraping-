import { NavLink, Route, Routes } from 'react-router-dom';
import { pages } from './features/index.jsx';
import { ServerWakeBanner } from './components/ServerWakeBanner.jsx';
import { Icon } from './components/Icons.jsx';
import { api } from './api/client.js';
import { usePolling } from './hooks/usePolling.js';

export default function App() {
  // Unread-alert count for the sidebar badge (fails quietly if the alerts feature is removed).
  const alerts = usePolling(() => api.listAlerts().catch(() => null), 30000);
  const badges = { alerts: alerts.data?.unreadCount || 0 };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><Icon name="logo" size={20} /></span>PriceTrack</div>
        <nav className="side-nav">
          {pages.filter((p) => p.nav).map((p) => (
            <NavLink key={p.path} to={p.path} end={p.path === '/'} className="side-link">
              <Icon name={p.icon} />
              <span>{p.nav}</span>
              {p.badge && badges[p.badge] > 0 && <span className="side-badge">{badges[p.badge]}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="side-card">
          <div className="side-card-label"><Icon name="pulse" size={14} /> Scheduler</div>
          <div className="side-card-title">Every 2 hours</div>
          <p>Checks run automatically through an external cron. Failures are logged, never hidden.</p>
        </div>
      </aside>
      <div className="main">
        <ServerWakeBanner />
        <main className="content">
          <Routes>
            {pages.map((p) => <Route key={p.path} path={p.path} element={p.element} />)}
            <Route path="*" element={<p>Page not found.</p>} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
