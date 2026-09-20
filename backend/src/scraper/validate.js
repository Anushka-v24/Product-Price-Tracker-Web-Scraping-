/**
 * Final gate before anything is saved. If this returns problems, the check is
 * recorded as FAILED and no price row is written - we never store a guess.
 */
const MAX_REASONABLE_PRICE = 10_000_000; // ₹1 crore; anything above is almost certainly a parsing bug

export function validateObservation(obs) {
  const problems = [];

  if (!obs || typeof obs !== 'object') return ['no observation'];
  if (!Number.isFinite(obs.price)) problems.push('price is missing or not a number');
  else if (obs.price <= 0) problems.push(`price must be positive (got ${obs.price})`);
  else if (obs.price > MAX_REASONABLE_PRICE) problems.push(`price ${obs.price} is unrealistically high`);

  if (obs.mrp != null && (!Number.isFinite(obs.mrp) || obs.mrp <= 0)) problems.push('mrp is invalid');

  if (typeof obs.inStock !== 'boolean') problems.push('stock status is missing');
  if (obs.stockQuantity != null && (!Number.isInteger(obs.stockQuantity) || obs.stockQuantity < 0)) {
    problems.push('stock quantity is invalid');
  }
  if (!obs.currency) problems.push('currency is missing');

  return problems;
}
