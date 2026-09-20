/** Coloured label for a check status: success / retried / failed / running. */
const LABELS = { success: 'Success', retried: 'Retried', failed: 'Failed', running: 'Running…' };

export function StatusBadge({ status, title }) {
  if (!status) return <span className="badge badge-none">No checks yet</span>;
  return <span className={`badge badge-${status}`} title={title}>{LABELS[status] ?? status}</span>;
}

export function StockBadge({ inStock, quantity }) {
  if (inStock == null) return <span className="badge badge-none">Unknown</span>;
  return inStock
    ? <span className="badge badge-success">In stock{quantity != null ? ` · ${quantity}` : ''}</span>
    : <span className="badge badge-failed">Out of stock</span>;
}
