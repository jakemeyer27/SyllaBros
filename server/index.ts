import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });
dotenv.config({ override: true });
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth } from './auth.js';
import routes from './routes.js';
import parseRoutes from './parseRoutes.js';
import canvasRoutes from './canvasRoutes.js';
import studyCoachRoutes from './studyCoachRoutes.js';

const app = express();
const PORT = process.env.PORT ?? 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api', requireAuth, parseRoutes);
app.use('/api', requireAuth, canvasRoutes);
app.use('/api', requireAuth, studyCoachRoutes);
app.use('/api', requireAuth, routes);

// Serve the built React frontend for everything else
app.use(express.static(path.join(__dirname, '../dist')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`SyllaBros running at http://localhost:${PORT}`);
});
