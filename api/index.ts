import express from 'express';
import cors from 'cors';
import { requireAuth } from '../server/auth.js';
import authRoutes from '../server/authRoutes.js';
import routes from '../server/routes.js';
import parseRoutes from '../server/parseRoutes.js';
import canvasRoutes from '../server/canvasRoutes.js';
import studyCoachRoutes from '../server/studyCoachRoutes.js';

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api', requireAuth, parseRoutes);
app.use('/api', requireAuth, canvasRoutes);
app.use('/api', requireAuth, studyCoachRoutes);
app.use('/api', requireAuth, routes);

export default app;
