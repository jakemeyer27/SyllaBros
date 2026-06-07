import { Router } from 'express';
import multer from 'multer';
import Anthropic from '@anthropic-ai/sdk';
import type { Request, Response } from 'express';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// ─── Text extraction helpers (non-PDF only) ───────────────────────────────────

async function extractTextFromBuffer(buffer: Buffer, filename: string): Promise<string> {
  const name = filename.toLowerCase();

  if (name.endsWith('.docx') || name.endsWith('.doc')) {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // Plain text / anything else
  return buffer.toString('utf-8');
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(
  text: string,
  courseName: string,
  courseCode: string,
  semesterStart: string,
  weeksInTerm: number
): string {
  return `You are a university syllabus parser. Extract graded assignments AND office hours from the syllabus.

Return ONLY a valid JSON object — no explanation, no markdown fences, no preamble. Exactly this shape:
{
  "assignments": [ ...assignment objects... ],
  "officeHours": [ ...office hours objects... ]
}

Course: ${courseCode || 'Unknown'} — ${courseName || 'Unknown'}
Semester start date: ${semesterStart}
Weeks in term: ${weeksInTerm}

══ ASSIGNMENTS ══
Each assignment object:
{
  "title": "exact assignment name",
  "dueDate": "YYYY-MM-DD or null",
  "type": "exam" | "quiz" | "homework" | "project" | "participation" | "other",
  "weight": 15,
  "maxScore": 100
}

DATE RULES:
- "Week N" → calculate the Monday of that week using ${semesterStart} as Week 1
- "Month Day" with no year → use the semester's year
- "Month Day, Year" → convert directly to YYYY-MM-DD
- No date → null

WEIGHT RULES:
- Number 0–100 representing % of final grade
- Range "15-20%" → use midpoint (17.5)
- Unclear → null

RECURRING ASSIGNMENTS:
- "10 weekly homeworks, 2% each" → 10 separate entries "Homework 1"–"Homework 10", spread weekly
- "5 quizzes, 4% each" → 5 entries
- Recurring but no count → 1 representative entry

TYPE MAPPING:
- midterm / final / test / exam → "exam"
- reading quiz / pop quiz → "quiz"
- paper / essay / report / presentation / case study → "project"
- lab / problem set / HW / pset / worksheet → "homework"
- attendance / participation / discussion → "participation"
- anything else → "other"

Only include GRADED items worth points toward the final grade.

══ OFFICE HOURS ══
Each office hours object:
{
  "personName": "Dr. Smith",
  "role": "professor" | "ta" | "other",
  "dayOfWeek": 1,
  "startTime": "14:00",
  "endTime": "16:00",
  "location": "Dallas Hall 201"
}

dayOfWeek: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
startTime / endTime: 24-hour "HH:MM" format
location: building/room or "Zoom" or "By appointment" etc.
If office hours appear multiple days, create one object per day.
If no office hours are mentioned, return an empty array [].

${text ? `SYLLABUS TEXT:\n${text.slice(0, 14000)}` : ''}`;
}

// ─── POST /parse-syllabus ─────────────────────────────────────────────────────

router.post('/parse-syllabus', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error: 'ANTHROPIC_API_KEY not configured',
        hint: 'Add ANTHROPIC_API_KEY=sk-ant-... to your .env.local file. Get a key at console.anthropic.com',
      });
      return;
    }

    const courseName    = req.body.course_name    ?? '';
    const courseCode    = req.body.course_code    ?? '';
    const semesterStart = req.body.semester_start ?? new Date().toISOString().slice(0, 10);
    const weeksInTerm   = Number(req.body.weeks_in_term ?? 16);

    const client = new Anthropic({ apiKey });

    const isPdf = req.file && req.file.originalname.toLowerCase().endsWith('.pdf');
    const hasText = !!(req.body.text ?? '').trim();

    // ── PDF → send directly to Claude as a native document ───────────────────
    if (isPdf && !hasText) {
      const pdfBase64 = req.file!.buffer.toString('base64');
      const promptText = buildPrompt('', courseName, courseCode, semesterStart, weeksInTerm);

      const message = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 4096,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: [{ role: 'user', content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } } as any,
          { type: 'text', text: promptText },
        ]}],
      });

      const rawText = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
      return sendParsed(res, rawText, req.file!.size);
    }

    // ── DOCX / TXT / pasted text → extract then send as text ─────────────────
    let syllabusText: string = req.body.text ?? '';

    if (req.file && !syllabusText.trim()) {
      syllabusText = await extractTextFromBuffer(req.file.buffer, req.file.originalname);
    }

    if (!syllabusText.trim()) {
      res.status(400).json({ error: 'No syllabus text found. Upload a file or paste the text.' });
      return;
    }

    const prompt = buildPrompt(syllabusText, courseName, courseCode, semesterStart, weeksInTerm);

    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
    return sendParsed(res, rawText, syllabusText.length);

  } catch (err) {
    console.error('[parse-syllabus]', err);
    res.status(500).json({ error: String(err) });
  }
});

// ─── Shared response helper ───────────────────────────────────────────────────

function sendParsed(res: Response, rawText: string, charsParsed: number) {
  const stripped = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    console.error('[parse-syllabus] Bad JSON from model:', stripped.slice(0, 500));
    res.status(500).json({
      error: 'AI returned invalid JSON. Try with cleaner syllabus text.',
      raw: stripped.slice(0, 300),
    });
    return;
  }

  // Support both old array format and new object format
  const rawAssignments: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as Record<string,unknown>).assignments)
      ? (parsed as Record<string,unknown>).assignments as unknown[]
      : [];

  const rawOfficeHours: unknown[] = Array.isArray((parsed as Record<string,unknown>)?.officeHours)
    ? (parsed as Record<string,unknown>).officeHours as unknown[]
    : [];

  const assignments = rawAssignments.map((a: unknown) => {
    const item = a as Record<string, unknown>;
    return {
      title:    typeof item.title === 'string'  ? item.title.trim() : 'Untitled',
      dueDate:  typeof item.dueDate === 'string' ? item.dueDate      : null,
      type:     ['exam','quiz','homework','project','participation','other'].includes(item.type as string)
                  ? item.type : 'other',
      weight:   item.weight   != null ? Number(item.weight)   : null,
      maxScore: item.maxScore != null ? Number(item.maxScore) : 100,
    };
  });

  const officeHours = rawOfficeHours.map((o: unknown) => {
    const item = o as Record<string, unknown>;
    return {
      personName: typeof item.personName === 'string' ? item.personName.trim() : 'Instructor',
      role:       ['professor','ta','other'].includes(item.role as string) ? item.role : 'other',
      dayOfWeek:  typeof item.dayOfWeek === 'number' ? Math.min(6, Math.max(0, item.dayOfWeek)) : 1,
      startTime:  typeof item.startTime === 'string' ? item.startTime : '09:00',
      endTime:    typeof item.endTime   === 'string' ? item.endTime   : '10:00',
      location:   typeof item.location  === 'string' ? item.location.trim() : '',
    };
  });

  res.json({ assignments, officeHours, charsParsed });
}

export default router;
