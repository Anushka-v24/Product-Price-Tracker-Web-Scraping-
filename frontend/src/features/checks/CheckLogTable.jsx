/** Every check attempt with its result. Click a row to see per-attempt details. */
import { Fragment, useState } from 'react';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { formatDateTime, formatPrice } from '../../utils/format.js';

export function CheckLogTable({ runs, showProduct = false }) {
  const [open, setOpen] = useState(null);
  if (!runs.length) return <p className="muted">No checks yet.</p>;

  return (
    <table className="table">
      <thead>
        <tr>
          <th>Started</th>{showProduct && <th>Product</th>}<th>Trigger</th><th>Result</th>
          <th>Attempts</th><th>Duration</th><th>Price</th><th>Error</th>
        </tr>
      </thead>
      <tbody>
        {runs.map((r) => (
          <Fragment key={r.id}>
            <tr className="clickable" onClick={() => setOpen(open === r.id ? null : r.id)}>
              <td>{formatDateTime(r.startedAt)}</td>
              {showProduct && <td>{r.productName}</td>}
              <td>{r.trigger}</td>
              <td><StatusBadge status={r.status} /></td>
              <td>{r.attempts}{r.details?.storeAttempts ? ` (store: ${r.details.storeAttempts})` : ''}</td>
              <td>{r.durationMs != null ? `${(r.durationMs / 1000).toFixed(1)} s` : '—'}</td>
              <td>{r.price != null ? formatPrice(r.price) : '—'}</td>
              <td className="error-cell" title={r.errorMessage ?? ''}>{r.errorCode ?? ''}</td>
            </tr>
            {open === r.id && (
              <tr><td colSpan={showProduct ? 8 : 7}>
                {r.errorMessage && <p className="error small">{r.errorMessage}</p>}
                <pre className="details">{JSON.stringify(r.details, null, 2)}</pre>
              </td></tr>
            )}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
