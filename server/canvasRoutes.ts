import { Router } from 'express';
import type { Request, Response } from 'express';

const router = Router();

// ─── Canvas API helper ────────────────────────────────────────────────────────

async function canvasFetch(canvasUrl: string, token: string, path: string): Promise<unknown> {
  const base = canvasUrl.replace(/\/$/, '');
  const url = `${base}/api/v1${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Canvas ${res.status} ${res.statusText}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

// ─── POST /canvas/test ────────────────────────────────────────────────────────

router.post('/canvas/test', async (req: Request, res: Response) => {
  try {
    const { canvasUrl, token } = req.body as { canvasUrl: string; token: string };
    if (!canvasUrl?.trim() || !token?.trim()) {
      res.status(400).json({ ok: false, error: 'canvasUrl and token are required' });
      return;
    }
    const profile = await canvasFetch(canvasUrl, token, '/users/self/profile') as { name: string };
    res.json({ ok: true, name: profile.name });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err) });
  }
});

// ─── POST /canvas/sync ────────────────────────────────────────────────────────

router.post('/canvas/sync', async (req: Request, res: Response) => {
  try {
    const { canvasUrl, token } = req.body as { canvasUrl: string; token: string };
    if (!canvasUrl?.trim() || !token?.trim()) {
      res.status(400).json({ error: 'canvasUrl and token required' });
      return;
    }

    // Fetch active courses
    const courses = await canvasFetch(
      canvasUrl, token,
      '/courses?enrollment_state=active&per_page=50'
    ) as Array<{ id: number; name: string; course_code: string }>;

    if (!Array.isArray(courses)) {
      res.status(502).json({ error: 'Unexpected response from Canvas. Check your URL.' });
      return;
    }

    const result: Array<{
      canvasCourseId: number;
      courseName: string;
      courseCode: string;
      assignments: Array<{
        id: number;
        name: string;
        due_at: string | null;
        points_possible: number | null;
        submission: { score: number | null } | null;
      }>;
    }> = [];

    for (const course of courses) {
      try {
        const assignments = await canvasFetch(
          canvasUrl, token,
          `/courses/${course.id}/assignments?per_page=100&include[]=submission&order_by=due_at`
        ) as Array<{
          id: number;
          name: string;
          due_at: string | null;
          points_possible: number | null;
          submission?: { score: number | null };
        }>;

        if (!Array.isArray(assignments)) continue;

        result.push({
          canvasCourseId: course.id,
          courseName: course.name,
          courseCode: course.course_code,
          assignments: assignments.map(a => ({
            id: a.id,
            name: a.name,
            due_at: a.due_at ?? null,
            points_possible: a.points_possible ?? null,
            submission: a.submission ? { score: a.submission.score ?? null } : null,
          })),
        });
      } catch {
        // Skip restricted courses silently
        continue;
      }
    }

    res.json({ courses: result });
  } catch (err) {
    console.error('[canvas/sync]', err);
    res.status(500).json({ error: String(err) });
  }
});

export default router;
