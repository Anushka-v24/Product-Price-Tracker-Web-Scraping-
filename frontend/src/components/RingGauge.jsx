/** Circular progress ring, e.g. scrape success rate. `value` 0-100 (or null). */
export function RingGauge({ value, size = 64 }) {
  const r = 26, c = 2 * Math.PI * r;
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="ring" aria-hidden="true">
      <circle cx="32" cy="32" r={r} className="ring-track" />
      <circle cx="32" cy="32" r={r} className="ring-value"
        strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 32 32)" />
    </svg>
  );
}
