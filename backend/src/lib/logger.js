/**
 * Tiny structured logger: one line per event, easy to read in Render's log viewer.
 *   logger.info('check finished', { productId: 458, status: 'success' })
 *   -> 2026-09-19T14:00:00.000Z INFO  check finished {"productId":458,"status":"success"}
 */
function write(level, message, context) {
  const line = `${new Date().toISOString()} ${level.padEnd(5)} ${message}`;
  const extra = context && Object.keys(context).length ? ` ${JSON.stringify(context)}` : '';
  (level === 'ERROR' ? console.error : console.log)(line + extra);
}

export const logger = {
  info: (msg, ctx) => write('INFO', msg, ctx),
  warn: (msg, ctx) => write('WARN', msg, ctx),
  error: (msg, ctx) => write('ERROR', msg, ctx),
  debug: (msg, ctx) => process.env.DEBUG && write('DEBUG', msg, ctx),
};
