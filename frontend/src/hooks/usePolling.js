import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Load data and refresh it every `intervalMs` (0 = load once).
 *   const { data, error, loading, reload } = usePolling(() => api.listTracked(), 10000);
 */
export function usePolling(load, intervalMs = 0, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(async () => {
    try {
      setData(await loadRef.current());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    reload();
    if (!intervalMs) return undefined;
    const timer = setInterval(reload, intervalMs);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, intervalMs, ...deps]);

  return { data, error, loading, reload };
}
