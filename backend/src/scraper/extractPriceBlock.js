/**
 * This function runs INSIDE the browser (via page.evaluate), so it must be self-contained:
 * no imports, no outside variables. It only COLLECTS raw text; the Node side parses and decides.
 *
 * Why so careful? The price block contains several decoy prices:
 *   <span class="price-value" style="display:none">₹2,937</span>      hidden decoy (the "obvious" selector!)
 *   <span style="text-decoration:line-through">₹3,022</span>          MRP (crossed out)
 *   <span>Deal price ₹2,800</span>                                    sometimes shown, not the selling price
 *   <b class="v8v7kyd pv-q9">₹2,690</b>                               <- the REAL price
 *   <span class="amount" data-price="true" style="display:none">₹3,302</span>  hidden decoy
 *
 * The real price element's class ("pv-q9") and tag (<b>, <span>, <strong>...) rotate and are
 * published at /api/layout. We use two independent methods and let Node cross-check them:
 *   1. layoutText   - the element carrying layout.classes.priceValue
 *   2. candidates   - every VISIBLE child of .price-main that is not crossed out / a badge / a deal label
 */
export function extractPriceBlock({ layout, selectors }) {
  const block = document.querySelector(selectors.successState);
  if (!block) return { found: false };
  const main = block.querySelector(selectors.priceMain);
  if (!main) return { found: true, hasMain: false };

  const isVisible = (el) => {
    const style = getComputedStyle(el);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      Number(style.opacity) > 0 &&
      el.getAttribute('aria-hidden') !== 'true' &&
      el.getClientRects().length > 0
    );
  };
  const isStruck = (el) => getComputedStyle(el).textDecorationLine.includes('line-through');
  const isLabelled = (el) => /deal price|% off|updating/i.test(el.textContent || '');

  const priceClass = layout?.classes?.priceValue;
  const layoutEl = priceClass ? [...main.getElementsByClassName(priceClass)].find(isVisible) : null;

  const children = [...main.children];
  const candidates = children
    .filter((el) => isVisible(el) && !isStruck(el) && !isLabelled(el) && /\d/.test(el.textContent || ''))
    .map((el) => el.textContent);

  const mrpEl = children.find((el) => isVisible(el) && isStruck(el));
  const badge = block.querySelector(selectors.stockBadge);

  return {
    found: true,
    hasMain: true,
    layoutText: layoutEl ? layoutEl.textContent : null,
    candidates,
    mrpText: mrpEl ? mrpEl.textContent : null,
    stockText: badge ? badge.textContent : null,
    stockOutClass: badge ? badge.classList.contains(selectors.outOfStockClass) : false,
    pending: /updating/i.test(main.textContent || ''),
    metaText: block.querySelector(selectors.attemptsMeta)?.textContent ?? null,
  };
}
