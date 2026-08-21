import express from 'express';
import cors from 'cors';
import { requireAuth } from '../server/auth.js';
import routes from '../server/routes.js';
import parseRoutes from '../server/parseRoutes.js';
import canvasRoutes from '../server/canvasRoutes.js';
import studyCoachRoutes from '../server/studyCoachRoutes.js';

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

// Proxy auth calls to the real Neon Auth server (avoids browser "Invalid origin" CORS error)
const NEON_AUTH_REAL = 'https://ep-old-bread-aktl98pt.neonauth.c-3.us-west-2.aws.neon.tech/neondb/auth';
app.all(/^\/api\/neon-auth/, async (req, res) => {
  try {
    const subpath = req.path.replace(/^\/api\/neon-auth/, '');
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    const target = `${NEON_AUTH_REAL}${subpath}${qs}`;
    const STRIP = new Set(['host', 'origin', 'referer', 'x-forwarded-for', 'x-forwarded-host']);
    const headers: Record<string, string> = { origin: 'http://localhost:5173' };
    for (const [k, v] of Object.entries(req.headers)) {
      if (STRIP.has(k.toLowerCase())) continue;
      headers[k] = Array.isArray(v) ? v.join(', ') : (v ?? '');
    }
    const fetchRes = await fetch(target, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
    });
    fetchRes.headers.forEach((v, k) => {
      if (k.toLowerCase() !== 'content-encoding') res.setHeader(k, v);
    });
    res.status(fetchRes.status).send(await fetchRes.text());
  } catch (e) {
    res.status(502).json({ error: 'Auth proxy error', detail: String(e) });
  }
});
app.use('/api', requireAuth, parseRoutes);
app.use('/api', requireAuth, canvasRoutes);
app.use('/api', requireAuth, studyCoachRoutes);
app.use('/api', requireAuth, routes);

export default app;
