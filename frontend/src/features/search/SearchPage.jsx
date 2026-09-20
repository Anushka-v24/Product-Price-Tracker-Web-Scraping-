/** Search the store's catalog (by full or partial name, or SKU) and start tracking a product. */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const navigate = useNavigate();

  // Search as you type (waits 300 ms after the last key press).
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return undefined; }
    const timer = setTimeout(async () => {
      try {
        const data = await api.searchCatalog(query);
        setResults(data.results);
        setCatalog(data.catalog);
        setError(null);
      } catch (e) {
        setError(e.message);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => { api.catalogStatus().then(setCatalog).catch(() => {}); }, []);

  async function track(product) {
    setBusyId(product.id);
    try {
      const tracked = await api.track(product.id);
      navigate(`/products/${tracked.id}`);
    } catch (e) {
      setError(e.message);
      setBusyId(null);
    }
  }

  return (
    <section>
      <h1>Track a product</h1>
      <p className="muted">Search by full or partial name (e.g. “copper track”) or by SKU (e.g. “COP-10195”).</p>
      <input
        className="search-input"
        autoFocus
        placeholder="Search products…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {catalog && (
        <p className="muted small">
          {catalog.count} products in the local catalog
          {catalog.sync?.running && ` · syncing… ${catalog.sync.found}/${catalog.sync.total ?? '?'}`}
        </p>
      )}
      {error && <p className="error">{error}</p>}

      <ul className="result-list">
        {results.map((p) => (
          <li key={p.id} className="result">
            <div>
              <div className="result-name">{p.name}</div>
              <div className="muted small">{p.brand} · {p.category} · SKU {p.sku}</div>
            </div>
            {p.trackedId ? (
              <button className="btn" onClick={() => navigate(`/products/${p.trackedId}`)}>View</button>
            ) : (
              <button className="btn btn-primary" disabled={busyId === p.id} onClick={() => track(p)}>
                {busyId === p.id ? 'Adding…' : 'Track'}
              </button>
            )}
          </li>
        ))}
      </ul>
      {query.trim().length >= 2 && !results.length && !error && <p className="muted">No products match “{query}”.</p>}
    </section>
  );
}
