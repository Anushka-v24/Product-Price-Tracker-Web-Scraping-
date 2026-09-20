/** Tiny price-trend line for dashboard cards. `values` = numbers, oldest first. */
export function Sparkline({ values, width = 220, height = 48 }) {
  if (!values || values.length < 2) return <div className="spark-empty">Not enough data for a trend yet</div>;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * width,
    height - 4 - ((v - min) / range) * (height - 8),
  ]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const up = values[values.length - 1] > values[0];
  const down = values[values.length - 1] < values[0];
  const cls = up ? 'spark-up' : down ? 'spark-down' : 'spark-flat';
  return (
    <svg className={`sparkline ${cls}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={`${line} L${width},${height} L0,${height} Z`} className="spark-area" />
      <path d={line} className="spark-line" />
    </svg>
  );
}
