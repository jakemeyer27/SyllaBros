import { useState, useMemo } from 'react';
import { format, addDays, parseISO, differenceInDays } from 'date-fns';
import {
  Brain, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2,
  Sparkles, BookOpen, Clock, Target, BarChart2, Loader2, RefreshCw,
  ChevronDown, ChevronUp, Save,
} from 'lucide-react';
import type { Course, Assignment, StudyBlock, TermConfig, StudyPreferences } from '../types';
import { apiUrl } from '../apiUrl';
import {
  computeStudyPriority, getPerformanceTrends, generateStudyBlocks, getEffectiveGrade,
} from '../scheduler';

interface Props {
  courses: Course[];
  assignments: Assignment[];
  studyBlocks: StudyBlock[];
  today: Date;
  termConfig: TermConfig;
  studyPrefs?: StudyPreferences;
  comprehensionScores: Record<string, number>;
  onUpdateComprehension: (courseId: string, score: number) => void;
  onSaveGenerated: (blocks: StudyBlock[]) => void;
  getToken: () => Promise<string>;
}

// COMP_OPTIONS defined near ComprehensionRow below

export default function StudyPlan({
  courses, assignments, studyBlocks, today, termConfig, studyPrefs,
  comprehensionScores, onUpdateComprehension, onSaveGenerated, getToken,
}: Props) {
  const [aiAdvice, setAiAdvice]       = useState('');
  const [aiLoading, setAiLoading]     = useState(false);
  const [aiError, setAiError]         = useState('');
  const [showAiSection, setShowAiSection] = useState(false);
  const [planSaved, setPlanSaved]     = useState(false);

  // ── Generate adaptive study blocks with comprehension + grade intelligence ──
  const generatedPlan = useMemo(() =>
    generateStudyBlocks(
      courses, assignments, studyBlocks, today,
      termConfig, studyPrefs, comprehensionScores,
    ),
    [courses, assignments, studyBlocks, today, termConfig, studyPrefs, comprehensionScores],
  );

  // ── Priority data per course ──────────────────────────────────────────────
  const coursePriorities = useMemo(() =>
    courses.map(c => ({
      course: c,
      priority: computeStudyPriority(c, assignments, comprehensionScores[c.id]),
      grade: getEffectiveGrade(c, assignments),
      trends: getPerformanceTrends(c.id, assignments),
      upcoming: assignments
        .filter(a => a.courseId === c.id && a.score === null && a.type !== 'participation')
        .filter(a => differenceInDays(parseISO(a.dueDate), today) >= 0)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .slice(0, 3),
    }))
    .sort((a, b) => b.priority.multiplier - a.priority.multiplier),
    [courses, assignments, today, comprehensionScores],
  );

  // ── Group plan by day ─────────────────────────────────────────────────────
  const planByDay = useMemo(() => {
    const map = new Map<string, StudyBlock[]>();
    for (const b of generatedPlan) {
      if (!map.has(b.date)) map.set(b.date, []);
      map.get(b.date)!.push(b);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [generatedPlan]);

  // ── Save the generated plan to the database ───────────────────────────────
  function handleSavePlan() {
    onSaveGenerated(generatedPlan);
    setPlanSaved(true);
    setTimeout(() => setPlanSaved(false), 3000);
  }

  // ── AI coach call ─────────────────────────────────────────────────────────
  async function handleGetAiAdvice() {
    setAiLoading(true);
    setAiError('');
    setAiAdvice('');
    try {
      const token = await getToken();
      const payload = {
        courses: coursePriorities.map(({ course, grade, trends, priority }) => ({
          code:          course.code,
          name:          course.name,
          currentGrade:  grade,
          targetGrade:   course.targetGrade,
          comprehension: comprehensionScores[course.id] ?? null,
          priorityLevel: priority.priority,
          priorityReasons: priority.reasons,
          examAvg:       trends.examAvg,
          quizAvg:       trends.quizAvg,
          hwAvg:         trends.hwAvg,
          trend:         trends.trend,
        })),
        upcomingAssignments: assignments
          .filter(a => a.score === null && a.type !== 'participation' && differenceInDays(parseISO(a.dueDate), today) >= 0)
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
          .slice(0, 10)
          .map(a => ({
            title:    a.title,
            type:     a.type,
            weight:   a.weight,
            dueDate:  a.dueDate,
            daysOut:  differenceInDays(parseISO(a.dueDate), today),
            courseCode: courses.find(c => c.id === a.courseId)?.code ?? '',
          })),
      };
      const res = await fetch(apiUrl('/api/study-coach'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as { advice: string };
      setAiAdvice(data.advice);
    } catch (e) {
      setAiError(String(e));
    } finally {
      setAiLoading(false);
    }
  }

  if (courses.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <Brain size={40} className="mx-auto mb-3 text-navy/30" />
        <p className="font-medium">Add courses to generate your adaptive study plan.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Brain size={22} className="text-navy" /> Adaptive Study Plan
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Personalized based on your grades, comprehension, and past performance
          </p>
        </div>
        {generatedPlan.length > 0 && (
          <button
            onClick={handleSavePlan}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              planSaved
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-navy text-white hover:bg-navy/90'
            }`}
          >
            {planSaved ? <CheckCircle2 size={14} /> : <Save size={14} />}
            {planSaved ? 'Saved to Schedule!' : 'Save Plan to Schedule'}
          </button>
        )}
      </div>

      {/* ── Section 1: Course Priority Cards ── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Target size={14} className="text-brand-orange" /> Priority Breakdown
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {coursePriorities.map(({ course, priority, grade, upcoming }) => (
            <PriorityCard
              key={course.id}
              course={course}
              priority={priority}
              grade={grade}
              upcoming={upcoming}
            />
          ))}
        </div>
      </div>

      {/* ── Section 2: Comprehension Check ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
          <BookOpen size={16} className="text-navy" /> Comprehension Check
        </h3>
        <p className="text-xs text-gray-400 mb-4">
          How well do you understand each course right now? Your answer adjusts how many study sessions are scheduled for that course.
        </p>
        <div className="divide-y divide-gray-50">
          {courses.map(course => (
            <ComprehensionRow
              key={course.id}
              course={course}
              score={comprehensionScores[course.id]}
              onRate={score => onUpdateComprehension(course.id, score)}
            />
          ))}
        </div>
      </div>

      {/* ── Section 3: Performance Trends ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <BarChart2 size={16} className="text-brand-orange" /> Performance Trends
        </h3>
        {coursePriorities.every(({ trends }) => trends.examAvg === null && trends.quizAvg === null && trends.hwAvg === null) ? (
          <p className="text-sm text-gray-400">Add graded assignments to see your performance trends.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {coursePriorities.map(({ course, trends }) => {
              if (trends.examAvg === null && trends.quizAvg === null && trends.hwAvg === null) return null;
              return (
                <TrendsCard key={course.id} course={course} trends={trends} />
              );
            })}
          </div>
        )}
      </div>

      {/* ── Section 4: Adaptive Weekly Plan ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Clock size={16} className="text-navy" /> Your Adaptive Study Schedule
          </h3>
          {generatedPlan.length > 0 && (
            <span className="text-xs text-gray-400">
              {generatedPlan.length} session{generatedPlan.length !== 1 ? 's' : ''} ·{' '}
              {Math.round(generatedPlan.reduce((s, b) => s + b.duration, 0) / 60 * 10) / 10}h total
            </span>
          )}
        </div>

        {planByDay.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-300" />
            <p className="text-sm font-medium">Nothing to study right now — you're all caught up!</p>
            <p className="text-xs mt-1">Add upcoming assignments to generate a plan.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {planByDay.map(([dateStr, blocks]) => (
              <DayRow
                key={dateStr}
                dateStr={dateStr}
                blocks={blocks}
                courses={courses}
                assignments={assignments}
                today={today}
                comprehensionScores={comprehensionScores}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Section 5: AI Study Coach ── */}
      <div className="bg-gradient-to-br from-navy/5 to-amber-warm/10 rounded-2xl border border-navy/10 p-5">
        <button
          className="w-full flex items-center justify-between"
          onClick={() => setShowAiSection(v => !v)}
        >
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Sparkles size={16} className="text-amber-warm" /> AI Study Coach
          </h3>
          {showAiSection ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>

        {showAiSection && (
          <div className="mt-4">
            <p className="text-sm text-gray-500 mb-4">
              Get personalized study recommendations from Claude based on your grades, comprehension ratings, and assignment history.
            </p>

            {!aiAdvice && !aiLoading && (
              <button
                onClick={handleGetAiAdvice}
                className="flex items-center gap-2 px-5 py-2.5 bg-navy text-white rounded-xl text-sm font-semibold hover:bg-navy/90 transition-colors"
              >
                <Sparkles size={15} />
                Generate My Personalized Advice
              </button>
            )}

            {aiLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                <Loader2 size={16} className="animate-spin text-navy" />
                Analyzing your academic profile…
              </div>
            )}

            {aiError && (
              <p className="text-sm text-crimson bg-crimson/5 rounded-lg p-3">{aiError}</p>
            )}

            {aiAdvice && (
              <div className="space-y-3">
                <div className="bg-white rounded-xl p-4 border border-navy/10 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {aiAdvice}
                </div>
                <button
                  onClick={handleGetAiAdvice}
                  className="flex items-center gap-1.5 text-xs text-navy font-medium hover:underline"
                >
                  <RefreshCw size={12} /> Refresh recommendations
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Priority Card ────────────────────────────────────────────────────────────

function PriorityCard({
  course, priority, grade, upcoming,
}: {
  course: Course;
  priority: ReturnType<typeof computeStudyPriority>;
  grade: number | null;
  upcoming: Assignment[];
}) {
  const badgeStyle: Record<string, string> = {
    high:   'bg-crimson/10 text-crimson',
    medium: 'bg-brand-orange/10 text-brand-orange',
    low:    'bg-emerald-50 text-emerald-600',
  };
  const badgeLabel: Record<string, string> = {
    high: 'High Priority', medium: 'Medium Priority', low: 'On Track',
  };
  const gap = grade !== null ? course.targetGrade - grade : null;

  return (
    <div
      className="rounded-2xl border p-4 space-y-3"
      style={{ borderColor: course.color + '30', background: course.color + '08' }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5" style={{ background: course.color }} />
          <div>
            <p className="text-sm font-bold text-gray-800">{course.code}</p>
            <p className="text-xs text-gray-500 truncate max-w-32">{course.name}</p>
          </div>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeStyle[priority.priority]}`}>
          {badgeLabel[priority.priority]}
        </span>
      </div>

      {/* Grade bar */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-500">Grade</span>
          <span className="font-bold" style={{ color: course.color }}>
            {grade !== null ? `${grade.toFixed(1)}%` : '—'}
            {gap !== null && <span className="ml-1 text-gray-400 font-normal">
              (target {course.targetGrade}%)
            </span>}
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className="h-1.5 rounded-full transition-all"
            style={{ width: `${Math.min(grade ?? 0, 100)}%`, background: course.color }}
          />
        </div>
        {gap !== null && gap > 0 && (
          <p className="text-[10px] text-crimson mt-0.5 font-medium">
            {gap.toFixed(1)} pts below target
          </p>
        )}
      </div>

      {/* Reasons */}
      {priority.reasons.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {priority.reasons.map((r, i) => (
            <span key={i} className="text-[10px] bg-white border border-gray-100 rounded-full px-2 py-0.5 text-gray-500">
              {r}
            </span>
          ))}
        </div>
      )}

      {/* Next up */}
      {upcoming[0] && (
        <div className="text-[11px] text-gray-500 border-t border-gray-100 pt-2">
          <span className="font-semibold text-gray-700">Next: </span>
          {upcoming[0].title}
          {' '}
          <span className={`font-bold ${
            differenceInDays(parseISO(upcoming[0].dueDate), new Date()) <= 3 ? 'text-crimson' : 'text-gray-400'
          }`}>
            ({differenceInDays(parseISO(upcoming[0].dueDate), new Date())}d)
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Comprehension Row ────────────────────────────────────────────────────────

const COMP_OPTIONS = [
  { value: 1, label: 'Lost',        color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
  { value: 2, label: 'Struggling',  color: '#f97316', bg: '#fff7ed', border: '#fed7aa' },
  { value: 3, label: 'Getting It',  color: '#ca8a04', bg: '#fefce8', border: '#fde68a' },
  { value: 4, label: 'Solid',       color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  { value: 5, label: 'Mastered',    color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
];

function ComprehensionRow({
  course, score, onRate,
}: {
  course: Course;
  score: number | undefined;
  onRate: (s: number) => void;
}) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      {/* Course header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: course.color }} />
        <span className="text-sm font-semibold text-gray-700">{course.code}</span>
        <span className="text-xs text-gray-400 truncate">{course.name}</span>
      </div>

      {/* Option pills */}
      <div className="flex flex-wrap gap-2 ml-4">
        {COMP_OPTIONS.map(opt => {
          const isSelected = score === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onRate(opt.value)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
              style={
                isSelected
                  ? {
                      background: opt.color,
                      borderColor: opt.color,
                      color: '#fff',
                    }
                  : {
                      background: '#fff',
                      borderColor: '#e5e7eb',
                      color: '#6b7280',
                    }
              }
            >
              {opt.label}
            </button>
          );
        })}
        {score !== undefined && (
          <button
            onClick={() => onRate(0 as never)}
            className="px-2 py-1.5 rounded-full text-xs border border-dashed border-gray-200 text-gray-300 hover:text-gray-400 transition-colors"
            title="Clear rating"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Trends Card ─────────────────────────────────────────────────────────────

function TrendsCard({
  course, trends,
}: {
  course: Course;
  trends: ReturnType<typeof getPerformanceTrends>;
}) {
  const TrendIcon = trends.trend === 'improving' ? TrendingUp
                  : trends.trend === 'declining' ? TrendingDown
                  : Minus;
  const trendColor = trends.trend === 'improving' ? 'text-emerald-500'
                   : trends.trend === 'declining' ? 'text-crimson'
                   : 'text-gray-400';

  // Insight: if exam avg significantly below hw avg
  let insight = '';
  if (trends.examAvg !== null && trends.hwAvg !== null && trends.hwAvg - trends.examAvg > 10) {
    insight = 'HW scores higher than exams — focus on test-taking strategy';
  } else if (trends.trend === 'declining') {
    insight = 'Scores trending down — increase study sessions';
  } else if (trends.trend === 'improving') {
    insight = 'Great progress — keep the momentum!';
  }

  return (
    <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: course.color }} />
          <span className="text-sm font-semibold text-gray-700">{course.code}</span>
        </div>
        {trends.trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
            <TrendIcon size={13} />
            {trends.trend.charAt(0).toUpperCase() + trends.trend.slice(1)}
            {Math.abs(trends.trendDiff) > 0.5 && (
              <span>({trends.trendDiff > 0 ? '+' : ''}{trends.trendDiff.toFixed(1)}%)</span>
            )}
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'Exams', val: trends.examAvg },
          { label: 'Quizzes', val: trends.quizAvg },
          { label: 'HW', val: trends.hwAvg },
        ].map(({ label, val }) => (
          <div key={label} className="bg-white rounded-lg p-2 border border-gray-100">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
            <p className={`text-sm font-bold mt-0.5 ${
              val === null ? 'text-gray-300' : val >= 90 ? 'text-emerald-500' : val >= 80 ? 'text-navy' : val >= 70 ? 'text-brand-orange' : 'text-crimson'
            }`}>
              {val !== null ? `${val.toFixed(0)}%` : '—'}
            </p>
          </div>
        ))}
      </div>
      {insight && (
        <p className="text-[11px] text-gray-500 mt-2 flex items-start gap-1">
          <AlertTriangle size={11} className="mt-0.5 flex-shrink-0 text-brand-orange" />
          {insight}
        </p>
      )}
    </div>
  );
}

// ─── Day Row ──────────────────────────────────────────────────────────────────

function DayRow({
  dateStr, blocks, courses, assignments, today, comprehensionScores,
}: {
  dateStr: string;
  blocks: StudyBlock[];
  courses: Course[];
  assignments: Assignment[];
  today: Date;
  comprehensionScores: Record<string, number>;
}) {
  const date    = parseISO(dateStr);
  const isToday = dateStr === format(today, 'yyyy-MM-dd');
  const isTomorrow = dateStr === format(addDays(today, 1), 'yyyy-MM-dd');
  const label   = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : format(date, 'EEEE, MMM d');

  return (
    <div>
      <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${isToday ? 'text-navy' : 'text-gray-400'}`}>
        {label}
      </p>
      <div className="space-y-2">
        {blocks.map(block => {
          const course = courses.find(c => c.id === block.courseId);
          const assignment = assignments.find(a => a.id === block.assignmentId);
          const daysOut = assignment ? differenceInDays(parseISO(assignment.dueDate), today) : null;
          const priority = course
            ? computeStudyPriority(course, assignments, comprehensionScores[course.id])
            : null;

          // Build context chip
          const chips: { label: string; color: string }[] = [];
          if (priority?.priority === 'high')   chips.push({ label: 'High Priority', color: '#ef4444' });
          if (priority?.priority === 'medium') chips.push({ label: 'Medium Priority', color: '#f97316' });
          if (assignment?.type === 'exam')     chips.push({ label: 'EXAM PREP', color: '#C4202A' });
          if (daysOut !== null && daysOut <= 3) chips.push({ label: `Due in ${daysOut}d`, color: '#C4202A' });
          else if (daysOut !== null && daysOut <= 7) chips.push({ label: `Due in ${daysOut}d`, color: '#f97316' });

          const comp = course ? comprehensionScores[course.id] : undefined;
          if (comp !== undefined && comp <= 2) chips.push({ label: `Comprehension ${comp}/5`, color: '#f97316' });

          return (
            <div
              key={block.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100 hover:border-gray-200 transition-colors"
            >
              <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ background: course?.color ?? '#aaa' }} />
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Clock size={12} className="text-gray-400" />
                <span className="text-xs font-bold text-gray-600">{block.duration}min</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">
                  {assignment?.title ?? 'Study Session'}
                </p>
                <p className="text-xs text-gray-400">{course?.code}</p>
              </div>
              {chips.length > 0 && (
                <div className="hidden sm:flex flex-wrap gap-1 flex-shrink-0">
                  {chips.slice(0, 2).map((chip, i) => (
                    <span
                      key={i}
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ color: chip.color, background: chip.color + '15' }}
                    >
                      {chip.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
