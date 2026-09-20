import { useEffect, useState } from 'react';
import { onSlowRequests } from '../api/client.js';

/** Shown while a request is slow - usually the free Render server waking up. */
export function ServerWakeBanner() {
  const [slow, setSlow] = useState(false);
  useEffect(() => onSlowRequests(setSlow), []);
  if (!slow) return null;
  return <div className="banner">Waking up the server… the first request after a quiet period can take up to a minute.</div>;
}
