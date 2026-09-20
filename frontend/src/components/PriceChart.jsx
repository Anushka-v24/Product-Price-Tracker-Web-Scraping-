/**
 * Price history chart drawn with plain SVG (no chart library to install or learn).
 * Line = price. Dots = each check (green = in stock, red = out of stock).
 */
import { formatPrice, formatDateTime } from '../utils/format.js';

const W = 800, H = 280, PAD = { top: 20, right: 20, bottom: 40, left: 80 };

export function PriceChart({ points }) {
  if (!points?.length) return <p className="muted">No price data yet. The first check usually finishes within a minute.</p>;

  const times = points.map((p) => new Date(p.capturedAt).getTime());
  const prices = points.map((p) => p.price);
  const [tMin, tMax] = [Math.min(...times), Math.max(...times)];
  let [pMin, pMax] = [Math.min(...prices), Math.max(...prices)];
  const margin = Math.max((pMax - pMin) * 0.15, pMax * 0.02, 1);
  pMin -= margin; pMax += margin;

  const x = (t) => PAD.left + (tMax === tMin ? 0.5 : (t - tMin) / (tMax - tMin)) * (W - PAD.left - PAD.right);
  const y = (p) => PAD.top + (1 - (p - pMin) / (pMax - pMin)) * (H - PAD.top - PAD.bottom);

  // Step line: a price holds until the next check changes it.
  let path = '';
  points.forEach((p, i) => {
    const px = x(times[i]), py = y(p.price);
    path += i === 0 ? `M${px},${py}` : ` H${px} V${py}`;
  });

  const yTicks = Array.from({ length: 5 }, (_, i) => pMin + ((pMax - pMin) * i) / 4);
  const xTicks = tMax === tMin ? [tMin] : Array.from({ length: 4 }, (_, i) => tMin + ((tMax - tMin) * i) / 3);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Price history chart">
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className="chart-grid" />
          <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" className="chart-label">{formatPrice(v)}</text>
        </g>
      ))}
      {xTicks.map((t) => (
        <text key={t} x={x(t)} y={H - 12} textAnchor="middle" className="chart-label">
          {new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </text>
      ))}
      <path d={path} className="chart-line" />
      {points.map((p, i) => (
        <circle key={p.id} cx={x(times[i])} cy={y(p.price)} r="5" className={p.inStock ? 'dot-in' : 'dot-out'}>
          <title>{`${formatPrice(p.price)} · ${p.inStock ? 'in stock' : 'out of stock'} · ${formatDateTime(p.capturedAt)}`}</title>
        </circle>
      ))}
    </svg>
  );
}
