import { NavLink, Route, Routes } from 'react-router-dom';
import { pages } from './features/index.jsx';
import { ServerWakeBanner } from './components/ServerWakeBanner.jsx';

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">📈 Price Tracker</div>
        <nav>
          {pages.filter((p) => p.nav).map((p) => (
            <NavLink key={p.path} to={p.path} end={p.path === '/'}>{p.nav}</NavLink>
          ))}
        </nav>
      </header>
      <ServerWakeBanner />
      <main className="content">
        <Routes>
          {pages.map((p) => <Route key={p.path} path={p.path} element={p.element} />)}
          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </main>
    </div>
  );
}
