/**
 * Price history chart drawn with plain SVG (no chart library).
 * Area + step line = price (a price holds until the next check changes it).
 * Dots = each check (green = in stock, red = out of stock). Hover to see the exact value.
 */
import { useId, useState } from 'react';
import { formatPrice, formatDateTime } from '../utils/format.js';

// Wide and short, so the chart doesn't push the tables below off the screen.
const W = 1200, H = 250, PAD = { top: 20, right: 24, bottom: 34, left: 84 };

export function PriceChart({ points }) {
  const gradientId = useId().replace(/:/g, '');
  const [hover, setHover] = useState(null);
  if (!points?.length) return <p className="muted">No price data yet. The first check usually finishes within a minute.</p>;

  const times = points.map((p) => new Date(p.capturedAt).getTime());
  const prices = points.map((p) => p.price);
  const [tMin, tMax] = [Math.min(...times), Math.max(...times)];
  let [pMin, pMax] = [Math.min(...prices), Math.max(...prices)];
  const margin = Math.max((pMax - pMin) * 0.15, pMax * 0.02, 1);
  pMin -= margin; pMax += margin;

  const x = (t) => PAD.left + (tMax === tMin ? 0.5 : (t - tMin) / (tMax - tMin)) * (W - PAD.left - PAD.right);
  const y = (p) => PAD.top + (1 - (p - pMin) / (pMax - pMin)) * (H - PAD.top - PAD.bottom);
  const bottom = H - PAD.bottom;

  let line = '';
  points.forEach((p, i) => {
    const px = x(times[i]), py = y(p.price);
    line += i === 0 ? `M${px},${py}` : ` H${px} V${py}`;
  });
  const lastX = x(times[times.length - 1]);
  const pillX = Math.min(Math.max(lastX, PAD.left + 44), W - 48); // keep the price tag inside the chart
  const area = `${line} V${bottom} H${x(times[0])} Z`;

  const yTicks = Array.from({ length: 4 }, (_, i) => pMin + ((pMax - pMin) * i) / 3);
  const xTicks = tMax === tMin ? [tMin] : Array.from({ length: 5 }, (_, i) => tMin + ((tMax - tMin) * i) / 4);

  // Hover: find the check closest to the mouse (in chart coordinates).
  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    times.forEach((t, i) => { if (Math.abs(x(t) - mx) < Math.abs(x(times[best]) - mx)) best = i; });
    setHover(best);
  }
  const h = hover != null ? points[hover] : null;
  const hx = h ? x(times[hover]) : 0, hy = h ? y(h.price) : 0;
  const boxW = 250, boxX = Math.min(Math.max(hx - boxW / 2, PAD.left), W - PAD.right - boxW);

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Price history chart"
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="chart-grad-top" />
            <stop offset="100%" className="chart-grad-bottom" />
          </linearGradient>
        </defs>
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className="chart-grid" />
            <text x={PAD.left - 10} y={y(v) + 4} textAnchor="end" className="chart-label">{formatPrice(v)}</text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <text key={t} x={x(t)} y={H - 8} className="chart-label"
            textAnchor={xTicks.length === 1 ? 'middle' : i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}>
            {new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </text>
        ))}
        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line} className="chart-line" />
        {points.map((p, i) => (
          <circle key={p.id} cx={x(times[i])} cy={y(p.price)} r={hover === i ? 7 : 4.5}
            className={p.inStock ? 'dot-in' : 'dot-out'} />
        ))}
        {!h && (
          <g>
            <rect x={pillX - 44} y={y(prices[prices.length - 1]) - 34} width="88" height="22" rx="6" className="chart-pill" />
            <text x={pillX} y={y(prices[prices.length - 1]) - 19} textAnchor="middle" className="chart-pill-text">
              {formatPrice(prices[prices.length - 1])}
            </text>
          </g>
        )}
        {h && (
          <g pointerEvents="none">
            <line x1={hx} x2={hx} y1={PAD.top} y2={bottom} className="chart-cross" />
            <rect x={boxX} y={Math.max(hy - 70, 4)} width={boxW} height="56" rx="8" className="chart-tip" />
            <text x={boxX + 12} y={Math.max(hy - 70, 4) + 22} className="chart-tip-price">{formatPrice(h.price)}</text>
            <text x={boxX + 12} y={Math.max(hy - 70, 4) + 42} className="chart-tip-sub">
              {h.inStock ? 'In stock' : 'Out of stock'} · {formatDateTime(h.capturedAt)}
            </text>
          </g>
        )}
      </svg>
      <div className="chart-legend">
        <span><i className="legend-dot in" /> In stock</span>
        <span><i className="legend-dot out" /> Out of stock</span>
        <span className="muted">{points.length} checks recorded</span>
      </div>
    </div>
  );
}
