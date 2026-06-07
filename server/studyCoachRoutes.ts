import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import type { Request, Response } from 'express';

const router = Router();

interface CourseData {
  code: string;
  name: string;
  currentGrade: number | null;
  targetGrade: number;
  comprehension: number | null;
  priorityLevel: 'high' | 'medium' | 'low';
  priorityReasons: string[];
  examAvg: number | null;
  quizAvg: number | null;
  hwAvg: number | null;
  trend: 'improving' | 'declining' | 'stable' | null;
}

interface AssignmentData {
  title: string;
  type: string;
  weight: number;
  dueDate: string;
  daysOut: number;
  courseCode: string;
}

router.post('/study-coach', async (req: Request, res: Response) => {
  try {
    const {
      courses,
      upcomingAssignments,
    } = req.body as { courses: CourseData[]; upcomingAssignments: AssignmentData[] };

    if (!courses?.length) {
      return res.status(400).json({ error: 'No course data provided' });
    }

    // Build a rich, data-driven prompt
    const courseLines = courses.map(c => {
      const gradeStr = c.currentGrade !== null ? `${c.currentGrade.toFixed(1)}%` : 'unknown grade';
      const gap = c.currentGrade !== null ? c.targetGrade - c.currentGrade : null;
      const gapStr = gap !== null ? (gap > 0 ? `${gap.toFixed(1)} pts below target` : `${Math.abs(gap).toFixed(1)} pts above target`) : '';
      const compStr = c.comprehension !== null ? `comprehension self-rated ${c.comprehension}/5 (${
        c.comprehension <= 1 ? 'lost' : c.comprehension <= 2 ? 'struggling' : c.comprehension <= 3 ? 'getting there' : c.comprehension <= 4 ? 'solid' : 'mastered'
      })` : 'comprehension not rated';
      const trendsStr = [
        c.examAvg !== null && `exam avg: ${c.examAvg.toFixed(0)}%`,
        c.quizAvg !== null && `quiz avg: ${c.quizAvg.toFixed(0)}%`,
        c.hwAvg !== null && `hw avg: ${c.hwAvg.toFixed(0)}%`,
        c.trend && `trend: ${c.trend}`,
      ].filter(Boolean).join(', ');

      return `• ${c.code} (${c.name}): ${gradeStr} / target ${c.targetGrade}%${gapStr ? ` — ${gapStr}` : ''}, ${compStr}${trendsStr ? `, ${trendsStr}` : ''}, priority: ${c.priorityLevel}`;
    }).join('\n');

    const assignmentLines = upcomingAssignments.slice(0, 8).map(a =>
      `• ${a.courseCode} — ${a.title} (${a.type}, ${a.weight}% of grade, due in ${a.daysOut} day${a.daysOut !== 1 ? 's' : ''})`
    ).join('\n');

    const prompt = `You are a sharp, supportive academic coach helping a college student optimize their study time. Analyze their data and give specific, actionable advice.

COURSE DATA:
${courseLines}

UPCOMING ASSIGNMENTS:
${assignmentLines || '(none in range)'}

Write a concise study coaching response with these four parts (use these exact headers):

**🎯 This Week's Priority**
Name the 1-2 courses that need the most focus and exactly why (cite their grade, comprehension rating, or upcoming high-stakes assignment).

**📚 Study Strategies**
For each high/medium priority course, give one concrete study tip tailored to their specific situation (e.g., if exam avg < hw avg, suggest active recall; if comprehension is 1-2, suggest going to office hours or rewatching lectures).

**📈 Pattern Insight**
Point out one meaningful pattern in their data (e.g., improving trend in one course, a gap between HW and exam performance, a class where they're exceeding their target).

**💪 Quick Win**
One specific action they can take TODAY based on what's most urgent.

Keep it tight — no fluff, no generic advice. Be direct and specific to their actual numbers.`;

    // Create client lazily (inside handler) so it picks up the env var
    // after dotenv.config() has run, not at module-load time.
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }],
    });

    const advice = message.content[0].type === 'text' ? message.content[0].text : '';
    res.json({ advice });
  } catch (err) {
    console.error('Study coach error:', err);
    res.status(500).json({ error: String(err) });
  }
});

export default router;
