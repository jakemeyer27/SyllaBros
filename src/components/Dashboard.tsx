import { useMemo } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { AlertTriangle, TrendingUp, TrendingDown, BookOpen, Clock, Zap } from 'lucide-react';
import type { Course, Assignment, StudyBlock, TermConfig } from '../types';
import type { GradingScale } from '../gradingScales';
import {
  getEffectiveGrade, computeGPA, detectCrunchWeeks, computeRiskFlags,
} from '../scheduler';

interface Props {
  courses: Course[];
  assignments: Assignment[];
  studyBlocks: StudyBlock[];
  today: Date;
  onNavigate: (tab: string) => void;
  gradingScale: GradingScale;
  termConfig: TermConfig;
}

export default function Dashboard({ courses, assignments, studyBlocks, today, onNavigate, gradingScale, termConfig }: Props) {
  const gpa = useMemo(() => computeGPA(courses, assignments, gradingScale), [courses, assignments, gradingScale]);
  const crunchWeeks = useMemo(() => detectCrunchWeeks(assignments, today, termConfig), [assignments, today, termConfig]);
  const riskFlags = useMemo(() => computeRiskFlags(courses, assignments), [courses, assignments]);

  const upcoming = useMemo(() =>
    assignments
      .filter(a => a.score === null && a.type !== 'participation')
      .filter(a => differenceInDays(parseISO(a.dueDate), today) >= 0)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 5),
    [assignments, today]
  );

  const todayBlocks = useMemo(() =>
    studyBlocks.filter(b => b.date === format(today, 'yyyy-MM-dd')),
    [studyBlocks, today]
  );

  const totalStudyToday = todayBlocks.reduce((s, b) => s + b.duration, 0);

  return (
    <div className="space-y-6">
      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Current GPA"
          value={gpa !== null ? gpa.toFixed(2) : '—'}
          sub={gpa !== null ? letterGrade(gpa) : 'No grades yet'}
          icon={<TrendingUp size={18} />}
          gradient="from-[#083152] to-[#145388]"
          iconBg="bg-white/15"
          textColor="text-white"
          subColor="text-white/60"
        />
        <StatCard
          label="Courses"
          value={String(courses.length)}
          sub={`${assignments.filter(a => a.score === null && a.type !== 'participation').length} items pending`}
          icon={<BookOpen size={18} />}
          gradient="from-[#F47920] to-[#FBBA3C]"
          iconBg="bg-white/20"
          textColor="text-white"
          subColor="text-white/70"
        />
        <StatCard
          label="Crunch Weeks"
          value={String(crunchWeeks.length)}
          sub={crunchWeeks.length > 0 ? `Next: ${format(parseISO(crunchWeeks[0].weekStart), 'MMM d')}` : 'None ahead'}
          icon={<Zap size={18} />}
          gradient={crunchWeeks.length > 0 ? 'from-[#C4202A] to-[#e53935]' : 'from-[#059669] to-[#34d399]'}
          iconBg="bg-white/15"
          textColor="text-white"
          subColor="text-white/60"
        />
        <StatCard
          label="Study Today"
          value={totalStudyToday > 0 ? `${Math.round(totalStudyToday / 60 * 10) / 10}h` : '—'}
          sub={todayBlocks.length > 0 ? `${todayBlocks.filter(b => b.isCompleted).length}/${todayBlocks.length} blocks done` : 'No sessions scheduled'}
          icon={<Clock size={18} />}
          gradient="from-[#0f766e] to-[#14b8a6]"
          iconBg="bg-white/15"
          textColor="text-white"
          subColor="text-white/60"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── GPA Risk ── */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-gray-50">
            <div className="w-8 h-8 rounded-xl bg-brand-orange/10 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={15} className="text-brand-orange" />
            </div>
            <h3 className="font-bold text-gray-800">GPA Risk Tracker</h3>
          </div>
          <div className="p-5 space-y-4">
            {courses.length === 0 && <p className="text-sm text-gray-400">Add courses to see risk analysis.</p>}
            {courses.map(c => {
              const grade = getEffectiveGrade(c, assignments);
              const flag = riskFlags.find(f => f.courseId === c.id);
              return (
                <div key={c.id} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                      <span className="text-sm font-semibold text-gray-700">{c.code}</span>
                    </div>
                    <span className="text-sm font-bold" style={{ color: c.color }}>
                      {grade !== null ? `${grade.toFixed(1)}%` : '—'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(grade ?? 0, 100)}%`, background: c.color }}
                    />
                  </div>
                  {flag && (
                    <p className={`text-xs ${flag.riskLevel === 'high' ? 'text-crimson' : flag.riskLevel === 'medium' ? 'text-brand-orange' : 'text-emerald-500'}`}>
                      {flag.message}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Upcoming Deadlines ── */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-gray-50">
            <div className="w-8 h-8 rounded-xl bg-navy/10 flex items-center justify-center flex-shrink-0">
              <Clock size={15} className="text-navy" />
            </div>
            <h3 className="font-bold text-gray-800">Upcoming Deadlines</h3>
          </div>
          <div className="p-4 space-y-2">
            {upcoming.length === 0 && (
              <p className="text-sm text-gray-400 px-1 py-2">No upcoming assignments.</p>
            )}
            {upcoming.map(a => {
              const course = courses.find(c => c.id === a.courseId);
              const days = differenceInDays(parseISO(a.dueDate), today);
              const urgent = days <= 2;
              const soon   = days <= 7;
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors border-l-[3px]"
                  style={{ borderLeftColor: course?.color ?? '#aaa' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{a.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{course?.code} · {a.weight}% of grade</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-black ${urgent ? 'text-crimson' : soon ? 'text-brand-orange' : 'text-gray-400'}`}>
                      {days === 0 ? 'Today' : days === 1 ? 'Tmrw' : `${days}d`}
                    </p>
                    <p className="text-[10px] text-gray-400">{format(parseISO(a.dueDate), 'MMM d')}</p>
                  </div>
                </div>
              );
            })}
          </div>
          {upcoming.length > 0 && (
            <div className="px-5 pb-4">
              <button onClick={() => onNavigate('schedule')} className="text-xs text-navy font-semibold hover:underline">
                View full schedule →
              </button>
            </div>
          )}
        </div>

        {/* ── Crunch Weeks ── */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-gray-50">
            <div className="w-8 h-8 rounded-xl bg-crimson/10 flex items-center justify-center flex-shrink-0">
              <Zap size={15} className="text-crimson" />
            </div>
            <h3 className="font-bold text-gray-800">Crunch Week Alerts</h3>
          </div>
          <div className="p-5">
            {crunchWeeks.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                  <TrendingDown size={22} className="text-emerald-400" />
                </div>
                <p className="text-sm font-medium text-gray-600">All clear</p>
                <p className="text-xs text-gray-400 mt-0.5">No crunch weeks in the next 6 weeks</p>
              </div>
            ) : (
              <div className="space-y-3">
                {crunchWeeks.slice(0, 3).map(cw => {
                  const byCourse = new Map<string, { course: Course | undefined; weight: number; items: Assignment[] }>();
                  for (const a of cw.assignments) {
                    if (!byCourse.has(a.courseId)) {
                      byCourse.set(a.courseId, { course: courses.find(c => c.id === a.courseId), weight: 0, items: [] });
                    }
                    const entry = byCourse.get(a.courseId)!;
                    entry.weight += a.weight;
                    entry.items.push(a);
                  }
                  return (
                    <div key={cw.weekStart} className="rounded-xl border border-crimson/20 overflow-hidden">
                      <div className="bg-crimson/8 px-3 py-2 flex items-center justify-between">
                        <p className="text-sm font-bold text-crimson">
                          Week of {format(parseISO(cw.weekStart), 'MMM d')}
                        </p>
                        <span className="text-[10px] font-bold text-crimson/70 bg-crimson/10 px-2 py-0.5 rounded-full">
                          {cw.totalWeight}% at stake
                        </span>
                      </div>
                      <div className="px-3 py-2.5 space-y-2">
                        {Array.from(byCourse.values()).map(({ course, weight, items }) => (
                          <div key={course?.id ?? 'unknown'}>
                            <div className="flex items-center justify-between mb-0.5">
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full" style={{ background: course?.color ?? '#aaa' }} />
                                <span className="text-xs font-bold" style={{ color: course?.color ?? '#aaa' }}>{course?.code}</span>
                              </div>
                              <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5"
                                style={{ background: (course?.color ?? '#aaa') + '20', color: course?.color ?? '#aaa' }}>
                                {weight.toFixed(0)}%
                              </span>
                            </div>
                            <div className="ml-3.5 space-y-0.5">
                              {items.map(a => (
                                <p key={a.id} className="text-[11px] text-gray-500 truncate">
                                  · {a.title}
                                  {a.type === 'exam' && <span className="ml-1 text-crimson font-bold">EXAM</span>}
                                </p>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Today's Study Plan ── */}
      {todayBlocks.length > 0 && (
        <div className="bg-gradient-to-r from-navy via-navy/95 to-[#145388] rounded-2xl p-5">
          <h3 className="font-bold text-white mb-3 flex items-center gap-2">
            <Clock size={16} className="text-amber-warm" /> Today's Study Plan
          </h3>
          <div className="flex flex-wrap gap-2">
            {todayBlocks.map(b => {
              const course = courses.find(c => c.id === b.courseId);
              const assignment = assignments.find(a => a.id === b.assignmentId);
              return (
                <div
                  key={b.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all ${
                    b.isCompleted
                      ? 'bg-white/10 text-white/40 line-through'
                      : 'bg-white/15 text-white hover:bg-white/20'
                  }`}
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: course?.color ?? '#aaa' }} />
                  <span className="font-bold">{b.duration}min</span>
                  <span className="text-white/70 truncate max-w-32">{assignment?.title ?? 'Study'}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon, gradient, iconBg, textColor, subColor }: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  gradient: string;
  iconBg: string;
  textColor: string;
  subColor: string;
}) {
  return (
    <div className={`bg-gradient-to-br ${gradient} rounded-2xl shadow-sm p-5 relative overflow-hidden`}>
      {/* Decorative circles */}
      <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />
      <div className="absolute -bottom-4 -right-2 w-16 h-16 rounded-full bg-white/5 pointer-events-none" />

      <div className="relative flex items-start justify-between mb-3">
        <p className={`text-[10px] font-bold uppercase tracking-widest ${subColor}`}>{label}</p>
        <div className={`p-2 rounded-xl ${iconBg} ${textColor}`}>{icon}</div>
      </div>
      <p className={`relative text-4xl font-black ${textColor} leading-none`}>{value}</p>
      <p className={`relative text-xs ${subColor} mt-2`}>{sub}</p>
    </div>
  );
}

function letterGrade(gpa: number): string {
  if (gpa >= 3.7) return 'A / A+';
  if (gpa >= 3.3) return 'A-';
  if (gpa >= 3.0) return 'B+';
  if (gpa >= 2.7) return 'B';
  if (gpa >= 2.3) return 'B-';
  if (gpa >= 2.0) return 'C+';
  return 'C or below';
}
