import { Router } from 'express';
import { sql } from './db.js';
import type { AuthedRequest } from './auth.js';
import type { Request, Response } from 'express';

const r = Router();
const uid = (req: Request) => (req as AuthedRequest).userId;

// ── Courses ───────────────────────────────────────────────────────────────────

r.get('/courses', async (req, res) => {
  const rows = await sql`
    SELECT * FROM courses WHERE user_id = ${uid(req)} ORDER BY created_at ASC
  `;
  res.json(rows);
});

r.post('/courses', async (req, res) => {
  const { name, code, credit_hours, color, target_grade, avg_homework_hours, overall_grade } = req.body;
  const [row] = await sql`
    INSERT INTO courses (user_id, name, code, credit_hours, color, target_grade, avg_homework_hours, overall_grade)
    VALUES (${uid(req)}, ${name}, ${code ?? ''}, ${credit_hours ?? 3}, ${color ?? '#6366f1'}, ${target_grade ?? 90}, ${avg_homework_hours ?? null}, ${overall_grade ?? null})
    RETURNING *
  `;
  res.status(201).json(row);
});

r.put('/courses/:id', async (req, res) => {
  const { name, code, credit_hours, color, target_grade, avg_homework_hours, overall_grade } = req.body;
  const [row] = await sql`
    UPDATE courses
    SET name=${name}, code=${code}, credit_hours=${credit_hours}, color=${color},
        target_grade=${target_grade}, avg_homework_hours=${avg_homework_hours ?? null},
        overall_grade=${overall_grade ?? null}
    WHERE id=${req.params.id} AND user_id=${uid(req)}
    RETURNING *
  `;
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(row);
});

r.delete('/courses/:id', async (req, res) => {
  await sql`DELETE FROM courses WHERE id=${req.params.id} AND user_id=${uid(req)}`;
  res.status(204).end();
});

// ── Assignments ───────────────────────────────────────────────────────────────

r.get('/assignments', async (req, res) => {
  const rows = await sql`
    SELECT a.* FROM assignments a
    JOIN courses c ON c.id = a.course_id
    WHERE c.user_id = ${uid(req)}
    ORDER BY a.due_date ASC
  `;
  res.json(rows);
});

r.post('/assignments', async (req, res) => {
  const { course_id, title, due_date, type, weight, score, max_score, tentative } = req.body;
  // Verify the course belongs to this user
  const [course] = await sql`SELECT id FROM courses WHERE id=${course_id} AND user_id=${uid(req)}`;
  if (!course) { res.status(403).json({ error: 'Course not found' }); return; }

  const [row] = await sql`
    INSERT INTO assignments (course_id, title, due_date, type, weight, score, max_score, tentative)
    VALUES (${course_id}, ${title}, ${due_date}, ${type ?? 'homework'}, ${weight ?? 10}, ${score ?? null}, ${max_score ?? 100}, ${tentative ?? false})
    RETURNING *
  `;
  res.status(201).json(row);
});

r.put('/assignments/:id', async (req, res) => {
  const { title, due_date, type, weight, score, max_score, tentative } = req.body;
  const [row] = await sql`
    UPDATE assignments a
    SET title=${title}, due_date=${due_date}, type=${type}, weight=${weight},
        score=${score ?? null}, max_score=${max_score}, tentative=${tentative ?? false}
    FROM courses c
    WHERE a.id=${req.params.id} AND a.course_id=c.id AND c.user_id=${uid(req)}
    RETURNING a.*
  `;
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(row);
});

r.delete('/assignments/:id', async (req, res) => {
  await sql`
    DELETE FROM assignments a
    USING courses c
    WHERE a.id=${req.params.id} AND a.course_id=c.id AND c.user_id=${uid(req)}
  `;
  res.status(204).end();
});

// ── Study Blocks ──────────────────────────────────────────────────────────────

r.get('/study-blocks', async (req, res) => {
  const rows = await sql`
    SELECT sb.* FROM study_blocks sb
    JOIN courses c ON c.id = sb.course_id
    WHERE c.user_id = ${uid(req)}
    ORDER BY sb.date ASC
  `;
  res.json(rows);
});

r.post('/study-blocks', async (req, res) => {
  const { course_id, assignment_id, date, duration, is_completed, is_auto_generated } = req.body;
  const [course] = await sql`SELECT id FROM courses WHERE id=${course_id} AND user_id=${uid(req)}`;
  if (!course) { res.status(403).json({ error: 'Course not found' }); return; }

  const [row] = await sql`
    INSERT INTO study_blocks (course_id, assignment_id, date, duration, is_completed, is_auto_generated)
    VALUES (${course_id}, ${assignment_id ?? null}, ${date}, ${duration ?? 30}, ${is_completed ?? false}, ${is_auto_generated ?? false})
    RETURNING *
  `;
  res.status(201).json(row);
});

r.post('/study-blocks/bulk', async (req, res) => {
  const blocks: Array<{
    course_id: string; assignment_id: string | null; date: string;
    duration: number; is_completed: boolean; is_auto_generated: boolean;
  }> = req.body;
  if (!Array.isArray(blocks) || blocks.length === 0) {
    res.json([]);
    return;
  }
  // Delete all existing auto-generated blocks for this user first
  await sql`
    DELETE FROM study_blocks sb
    USING courses c
    WHERE sb.course_id=c.id AND c.user_id=${uid(req)} AND sb.is_auto_generated=true
  `;
  // Insert all new ones
  const rows = await Promise.all(blocks.map(b => sql`
    INSERT INTO study_blocks (course_id, assignment_id, date, duration, is_completed, is_auto_generated)
    VALUES (${b.course_id}, ${b.assignment_id ?? null}, ${b.date}, ${b.duration}, ${b.is_completed}, ${b.is_auto_generated})
    RETURNING *
  `.then(r => r[0])));
  res.status(201).json(rows);
});

r.patch('/study-blocks/:id/toggle', async (req, res) => {
  const [row] = await sql`
    UPDATE study_blocks sb
    SET is_completed = NOT sb.is_completed
    FROM courses c
    WHERE sb.id=${req.params.id} AND sb.course_id=c.id AND c.user_id=${uid(req)}
    RETURNING sb.*
  `;
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(row);
});

r.delete('/study-blocks/:id', async (req, res) => {
  await sql`
    DELETE FROM study_blocks sb
    USING courses c
    WHERE sb.id=${req.params.id} AND sb.course_id=c.id AND c.user_id=${uid(req)}
  `;
  res.status(204).end();
});

export default r;
