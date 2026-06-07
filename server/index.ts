import dotenv from 'dotenv';
// override: true ensures .env.local values win even when the shell has already
// set ANTHROPIC_API_KEY="" (e.g. the Claude Code harness blanks it for security).
dotenv.config({ path: '.env.local', override: true });
dotenv.config({ override: true }); // fallback to .env
import express from 'express';
import cors from 'cors';
import { requireAuth } from './auth.js';
import routes from './routes.js';
import parseRoutes from './parseRoutes.js';
import canvasRoutes from './canvasRoutes.js';
import studyCoachRoutes from './studyCoachRoutes.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:4173',
  // Add your Vercel URL here after deploying, e.g.:
  // 'https://syllabros.vercel.app',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

// parseRoutes uses multer (multipart/form-data), must come before express.json() bodies are assumed
app.use('/api', requireAuth, parseRoutes);
app.use('/api', requireAuth, canvasRoutes);
app.use('/api', requireAuth, studyCoachRoutes);
app.use('/api', requireAuth, routes);

app.listen(PORT, () => {
  console.log(`SyllaBros API running at http://localhost:${PORT}`);
});
