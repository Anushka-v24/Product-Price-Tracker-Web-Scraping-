/**
 * Pure functions that decide which alerts a new snapshot should raise.
 * No database, no side effects - easy to unit test and easy to extend:
 * to add a new alert type, add a rule here and allow the type in a new migration.
 */
const formatInr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

export function alertsFor({ previous, current }) {
  if (!previous || !current) return []; // first ever snapshot: nothing to compare with
  const alerts = [];

  if (current.price < previous.price) {
    const pct = Math.round(((previous.price - current.price) / previous.price) * 100);
    alerts.push({
      type: 'price_drop',
      message: `Price dropped ${pct}% from ${formatInr(previous.price)} to ${formatInr(current.price)}`,
      oldValue: previous.price,
      newValue: current.price,
    });
  }

  if (!previous.inStock && current.inStock) {
    alerts.push({
      type: 'back_in_stock',
      message: current.stockQuantity ? `Back in stock (${current.stockQuantity} available)` : 'Back in stock',
      oldValue: 0,
      newValue: current.stockQuantity,
    });
  }

  return alerts;
}
