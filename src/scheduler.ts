import { addDays, differenceInDays, format, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import type { Assignment, Course, StudyBlock, TermConfig, StudyPreferences } from './types';
import { TERM_CONFIGS } from './types';
import { scoreToGpaPoints, getDefaultScale } from './gradingScales';
import type { GradingScale } from './gradingScales';

// ─── Study Priority & Intelligence ───────────────────────────────────────────

export interface StudyPriority {
  priority: 'high' | 'medium' | 'low';
  multiplier: number;
  reasons: string[];
}

/**
 * Computes how much study effort a course deserves right now.
 * Factors in: grade vs target gap + self-reported comprehension (1–5).
 */
export function computeStudyPriority(
  course: Course,
  assignments: Assignment[],
  comprehensionScore?: number,   // 1–5, undefined = unknown
): StudyPriority {
  const grade = getEffectiveGrade(course, assignments);
  const gap   = grade !== null ? course.targetGrade - grade : 8; // assume medium gap if unknown
  const reasons: string[] = [];

  // Grade gap → multiplier
  let gapMult = 1.0;
  if      (gap > 15) { gapMult = 2.8; reasons.push(`${gap.toFixed(0)} pts below target`); }
  else if (gap > 8)  { gapMult = 2.0; reasons.push(`${gap.toFixed(0)} pts below target`); }
  else if (gap > 3)  { gapMult = 1.5; reasons.push(`${gap.toFixed(0)} pts below target`); }
  else if (gap < -5) { gapMult = 0.7; reasons.push('Above target'); }
  else                { gapMult = 1.0; }

  // Comprehension → multiplier
  let compMult = 1.3; // default: slight uncertainty
  if (comprehensionScore !== undefined) {
    if      (comprehensionScore <= 1) { compMult = 2.5; reasons.push('Comprehension 1/5 — lost'); }
    else if (comprehensionScore <= 2) { compMult = 2.0; reasons.push('Comprehension 2/5 — struggling'); }
    else if (comprehensionScore <= 3) { compMult = 1.4; reasons.push('Comprehension 3/5 — getting there'); }
    else if (comprehensionScore <= 4) { compMult = 1.0; reasons.push('Comprehension 4/5 — solid'); }
    else                              { compMult = 0.65; reasons.push('Comprehension 5/5 — mastered'); }
  }

  const multiplier = gapMult * compMult;
  const priority: StudyPriority['priority'] =
    multiplier >= 2.5 ? 'high' : multiplier >= 1.3 ? 'medium' : 'low';

  return { priority, multiplier, reasons };
}

export interface PerformanceTrends {
  examAvg:  number | null;
  quizAvg:  number | null;
  hwAvg:    number | null;
  trend:    'improving' | 'declining' | 'stable' | null;
  trendDiff: number;  // positive = improving
}

/**
 * Analyses past assignment scores per course to surface patterns.
 */
export function getPerformanceTrends(courseId: string, assignments: Assignment[]): PerformanceTrends {
  const graded = assignments.filter(a => a.courseId === courseId && a.score !== null);
  const pct    = (a: Assignment) => (a.score! / a.maxScore) * 100;
  const avg    = (arr: Assignment[]) => arr.length ? arr.reduce((s, a) => s + pct(a), 0) / arr.length : null;

  const exams = graded.filter(a => a.type === 'exam');
  const quizzes = graded.filter(a => a.type === 'quiz');
  const hw    = graded.filter(a => a.type === 'homework');

  // Trend: compare first half vs second half (by due date)
  let trend:     PerformanceTrends['trend'] = null;
  let trendDiff = 0;
  if (graded.length >= 4) {
    const sorted    = [...graded].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const mid       = Math.floor(sorted.length / 2);
    const firstAvg  = sorted.slice(0, mid).reduce((s, a) => s + pct(a), 0) / mid;
    const secondAvg = sorted.slice(mid).reduce((s, a) => s + pct(a), 0) / (sorted.length - mid);
    trendDiff = secondAvg - firstAvg;
    if      (trendDiff >  3) trend = 'improving';
    else if (trendDiff < -3) trend = 'declining';
    else                     trend = 'stable';
  }

  return {
    examAvg:  avg(exams),
    quizAvg:  avg(quizzes),
    hwAvg:    avg(hw),
    trend,
    trendDiff,
  };
}

/**
 * Returns the grade to use everywhere for a course:
 * - If the user has entered an overall grade override, use that.
 * - Otherwise compute from individual graded assignments.
 */
export function getEffectiveGrade(course: Course, assignments: Assignment[]): number | null {
  if (course.overallGrade !== null && course.overallGrade !== undefined) return course.overallGrade;
  return computeCurrentGrade(course.id, assignments);
}

export function computeCurrentGrade(courseId: string, assignments: Assignment[]): number | null {
  const graded = assignments.filter(a => a.courseId === courseId && a.score !== null);
  if (graded.length === 0) return null;
  const totalWeight = graded.reduce((s, a) => s + a.weight, 0);
  if (totalWeight === 0) return null;
  const earned = graded.reduce((s, a) => s + (a.score! / a.maxScore) * a.weight, 0);
  return (earned / totalWeight) * 100;
}

export function computeProjectedGrade(courseId: string, assignments: Assignment[]): number {
  const all = assignments.filter(a => a.courseId === courseId);
  if (all.length === 0) return 0;
  let earnedWeight = 0;
  let totalWeightGraded = 0;
  for (const a of all) {
    if (a.score !== null) {
      earnedWeight += (a.score / a.maxScore) * a.weight;
      totalWeightGraded += a.weight;
    }
  }
  if (totalWeightGraded === 0) return 0;
  const pct = earnedWeight / totalWeightGraded;
  const totalWeight = all.reduce((s, a) => s + a.weight, 0);
  return pct * Math.min(totalWeight, 100);
}

/** @deprecated Pass a GradingScale instead — kept for back-compat in callers that haven't been updated yet */
export function gpaPoints(grade: number, scale?: GradingScale): number {
  return scoreToGpaPoints(grade, scale ?? getDefaultScale());
}

export function computeGPA(courses: Course[], assignments: Assignment[], scale?: GradingScale): number | null {
  const s = scale ?? getDefaultScale();
  let totalPoints = 0;
  let totalCredits = 0;
  for (const c of courses) {
    const grade = getEffectiveGrade(c, assignments);
    if (grade === null) continue;
    totalPoints += scoreToGpaPoints(grade, s) * c.creditHours;
    totalCredits += c.creditHours;
  }
  if (totalCredits === 0) return null;
  return totalPoints / totalCredits;
}

export interface CrunchWeek {
  weekStart: string;
  weekEnd: string;
  totalWeight: number;
  assignments: Assignment[];
}

export function detectCrunchWeeks(assignments: Assignment[], today: Date, termConfig?: TermConfig): CrunchWeek[] {
  const lookahead = termConfig?.crunchLookaheadDays ?? TERM_CONFIGS.semester.crunchLookaheadDays;
  // Only high-stakes types count toward crunch weeks — homework is routine, not crunch
  const CRUNCH_TYPES: Assignment['type'][] = ['exam', 'project', 'quiz', 'other'];

  const upcoming = assignments.filter(a => {
    const due = parseISO(a.dueDate);
    const days = differenceInDays(due, today);
    return days >= 0 && days <= lookahead && CRUNCH_TYPES.includes(a.type);
  });

  const weekMap = new Map<string, Assignment[]>();
  for (const a of upcoming) {
    const due = parseISO(a.dueDate);
    const ws = format(startOfWeek(due, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    if (!weekMap.has(ws)) weekMap.set(ws, []);
    weekMap.get(ws)!.push(a);
  }

  const crunch: CrunchWeek[] = [];
  for (const [ws, items] of weekMap) {
    const totalWeight = items.reduce((s, a) => s + a.weight, 0);
    if (totalWeight >= 20 || items.filter(a => a.type === 'exam').length >= 2) {
      const wsDate = parseISO(ws);
      crunch.push({
        weekStart: ws,
        weekEnd: format(endOfWeek(wsDate, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        totalWeight,
        assignments: items.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      });
    }
  }
  return crunch.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export function generateStudyBlocks(
  courses: Course[],
  assignments: Assignment[],
  existingBlocks: StudyBlock[],
  today: Date,
  termConfig?: TermConfig,
  prefs?: StudyPreferences,
  comprehensionScores?: Record<string, number>,  // courseId → 1-5
): StudyBlock[] {
  const lookahead = termConfig?.studyLookaheadDays ?? TERM_CONFIGS.semester.studyLookaheadDays;

  // Preference values with safe defaults
  const preferredDays  = prefs?.preferredDays?.length ? prefs.preferredDays : [0,1,2,3,4,5,6];
  const baseDuration   = prefs?.sessionDuration ?? 45;
  const studyStyle     = prefs?.studyStyle ?? 'balanced';

  const upcoming = assignments.filter(a => {
    const due = parseISO(a.dueDate);
    const daysOut = differenceInDays(due, today);
    return a.score === null && daysOut >= 0 && daysOut <= lookahead && a.weight >= 5
      && a.type !== 'participation';
  });

  const generatedBlocks: StudyBlock[] = [];

  for (const assignment of upcoming) {
    const course = courses.find(c => c.id === assignment.courseId);
    if (!course) continue;

    const dueDate  = parseISO(assignment.dueDate);
    const daysOut  = differenceInDays(dueDate, today);

    // Compute adaptive priority for this course
    const comp = comprehensionScores?.[course.id];
    const { priority, multiplier } = computeStudyPriority(course, assignments, comp);

    // Max window to look back from due date
    const baseWindow = assignment.type === 'exam' ? 7
                     : assignment.type === 'project' ? 5
                     : 3;
    const window = Math.min(daysOut, baseWindow);

    // Number of blocks — scaled by priority
    const baseBlocks = assignment.type === 'exam' ? 4
                     : assignment.type === 'project' ? 3
                     : 2;
    const numBlocks = Math.min(Math.round(baseBlocks * Math.min(multiplier, 2.5)), window);

    // Duration — scaled by priority
    let duration = baseDuration;
    if      (priority === 'high')   duration = Math.max(baseDuration + 20, 60);
    else if (priority === 'medium') duration = Math.max(baseDuration + 5, 45);
    if (assignment.type === 'exam') duration = Math.max(duration, baseDuration + 15);

    // All candidate day offsets from today within the window, filtered to preferred days
    const allOffsets = Array.from({ length: daysOut }, (_, i) => i)
      .filter(offset => preferredDays.includes(addDays(today, offset).getDay()));

    // Fallback to any day if no preferred days fall in range
    const candidates = allOffsets.length
      ? allOffsets
      : Array.from({ length: daysOut }, (_, i) => i);

    // Select offsets based on study style
    const windowOffsets = candidates.filter(o => o >= daysOut - window);
    let selected: number[];

    if (studyStyle === 'spread') {
      // Prefer earliest days — start studying as soon as possible
      selected = candidates.slice(0, numBlocks);
    } else if (studyStyle === 'crunch') {
      // Prefer latest days — cluster right before deadline
      selected = windowOffsets.slice(-numBlocks);
    } else {
      // Balanced — use the window before due date, distributed evenly
      selected = windowOffsets.slice(0, numBlocks);
    }

    for (const offset of selected) {
      const blockDate = format(addDays(today, offset), 'yyyy-MM-dd');
      const alreadyExists =
        existingBlocks.some(b => b.assignmentId === assignment.id && b.date === blockDate) ||
        generatedBlocks.some(b => b.assignmentId === assignment.id && b.date === blockDate);
      if (alreadyExists) continue;

      generatedBlocks.push({
        id: `auto-${assignment.id}-${blockDate}`,
        courseId: assignment.courseId,
        assignmentId: assignment.id,
        date: blockDate,
        duration,
        isCompleted: false,
        isAutoGenerated: true,
      });
    }
  }

  return generatedBlocks;
}

export interface RiskFlag {
  courseId: string;
  courseName: string;
  currentGrade: number;
  targetGrade: number;
  riskLevel: 'low' | 'medium' | 'high';
  message: string;
}

export function computeRiskFlags(courses: Course[], assignments: Assignment[]): RiskFlag[] {
  const flags: RiskFlag[] = [];
  for (const course of courses) {
    const grade = getEffectiveGrade(course, assignments);
    if (grade === null) continue;
    const gap = course.targetGrade - grade;
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    let message = '';
    if (gap > 10) { riskLevel = 'high'; message = `${gap.toFixed(1)} pts below target — high risk to GPA`; }
    else if (gap > 4) { riskLevel = 'medium'; message = `${gap.toFixed(1)} pts below target — monitor closely`; }
    else if (gap < -5) { riskLevel = 'low'; message = `${Math.abs(gap).toFixed(1)} pts above target — looking great`; }
    if (riskLevel !== 'low' || gap < -5) {
      flags.push({ courseId: course.id, courseName: course.name, currentGrade: grade, targetGrade: course.targetGrade, riskLevel, message });
    }
  }
  return flags;
}
