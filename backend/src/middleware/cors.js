/**
 * CORS: lets the React app (on Vercel, a different domain) call this API.
 * Written by hand instead of using the `cors` package - it's only a few lines.
 * Allowed origins come from CORS_ORIGIN (comma-separated, or "*").
 */
export function cors(allowedOrigins) {
  const allowAll = allowedOrigins.includes('*');
  return (req, res, next) => {
    const origin = req.get('origin');
    if (origin && (allowAll || allowedOrigins.includes(origin))) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Vary', 'Origin');
      res.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type,X-Cron-Secret');
    }
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  };
}
