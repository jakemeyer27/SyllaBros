import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { Calendar, Pencil, Check, X, RotateCcw, Target, Plus, Trash2, ChevronDown } from 'lucide-react';
import type { Course, Assignment, TermType, TermConfig, SemesterRecord } from '../types';
import { TERM_CONFIGS } from '../types';
import type { GradingScale } from '../gradingScales';
import { scoreToGpaPoints, scoreToLetter } from '../gradingScales';
import { getEffectiveGrade, computeCurrentGrade, computeProjectedGrade, computeGPA } from '../scheduler';

interface Props {
  courses: Course[];
  assignments: Assignment[];
  gradingScale: GradingScale;
  termConfig: TermConfig;
  onTermChange: (type: TermType) => void;
  onUpdate: (a: Assignment) => void;
  onUpdateCourse: (c: Course) => void;
  semesterHistory: SemesterRecord[];
  onAddSemester: (s: SemesterRecord) => void;
  onDeleteSemester: (id: string) => void;
}

export default function Grades({ courses, assignments, gradingScale, termConfig, onTermChange, onUpdate, onUpdateCourse, semesterHistory, onAddSemester, onDeleteSemester }: Props) {
  const gpa = useMemo(() => computeGPA(courses, assignments, gradingScale), [courses, assignments, gradingScale]);
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());

  function toggleCourse(id: string) {
    setExpandedCourses(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const courseStats = useMemo(() =>
    courses.map(c => {
      const effective  = getEffectiveGrade(c, assignments);
      const computed   = computeCurrentGrade(c.id, assignments);
      const projected  = computeProjectedGrade(c.id, assignments);
      return { course: c, current: effective, computed, projected };
    }),
    [courses, assignments]
  );

  const barData = courseStats.map(s => ({
    name: s.course.code.split(' ')[0],
    current: s.current ?? 0,
    target: s.course.targetGrade,
    color: s.course.color,
  }));

  const aCutoff = gradingScale.grades.find(g => g.letter === 'A')?.minPercent ?? 93;

  return (
    <div className="space-y-6">
      {/* GPA Banner */}
      <div className="bg-gradient-to-br from-navy via-navy to-navy/85 rounded-3xl p-6 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-36 h-36 rounded-full bg-white/5 -translate-y-10 translate-x-10 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-white/5 translate-y-10 -translate-x-10 pointer-events-none" />
        <div className="relative flex items-end justify-between">
          <div>
            <p className="text-white/60 text-[11px] font-bold uppercase tracking-widest">Current GPA</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-4xl select-none">
                {gpa === null ? '📚' : gpa >= 3.85 ? '🏆' : gpa >= 3.5 ? '⭐' : gpa >= 3.0 ? '📖' : gpa >= 2.5 ? '💪' : '🔥'}
              </span>
              <p className="text-5xl font-black tracking-tight">{gpa !== null ? gpa.toFixed(2) : '—'}</p>
            </div>
            {gpa !== null && (
              <span className="inline-block mt-2 px-3 py-1 rounded-full bg-white/15 text-white/90 text-xs font-bold">
                {gpaLabel(gpa)}
              </span>
            )}
          </div>
          <div className="text-right flex flex-col gap-1.5 items-end">
            <span className="text-xs font-bold text-white px-2.5 py-1 rounded-full bg-white/15">
              🎯 {assignments.filter(a => a.score !== null).length} graded
            </span>
            <span className="text-xs font-bold text-white px-2.5 py-1 rounded-full bg-white/15">
              📚 {courses.length} courses
            </span>
            <p className="text-white/40 text-[11px] mt-0.5">{gradingScale.shortName} scale</p>
          </div>
        </div>
      </div>

      {/* Term Type */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-amber-warm/15 rounded-xl flex items-center justify-center flex-shrink-0">
              <Calendar size={16} className="text-brand-orange" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5"><span>🗓️</span> Academic Term</p>
              <p className="text-xs text-gray-400">
                {termConfig.weeksPerTerm}-week terms · {termConfig.termsPerYear} per year · study blocks look {termConfig.studyLookaheadDays} days ahead
              </p>
            </div>
          </div>
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl flex-shrink-0">
            {(Object.keys(TERM_CONFIGS) as TermType[]).map(type => (
              <button
                key={type}
                onClick={() => onTermChange(type)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  termConfig.type === type ? 'bg-navy text-white shadow-sm' : 'text-gray-500 hover:text-navy'
                }`}
              >
                {TERM_CONFIGS[type].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grade comparison chart */}
      {barData.some(d => d.current > 0) && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="text-xl">📊</span> Current vs Target
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} barGap={4}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={32} />
              <Tooltip formatter={(v) => typeof v === 'number' ? `${v.toFixed(1)}%` : v} />
              <ReferenceLine
                y={aCutoff} stroke="#083152" strokeDasharray="4 2" opacity={0.35}
                label={{ value: 'A', position: 'right', fontSize: 11, fill: '#083152' }}
              />
              <Bar dataKey="current" radius={[6, 6, 0, 0]} name="Current">
                {barData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
              <Bar dataKey="target" radius={[6, 6, 0, 0]} fill="#e5e7eb" name="Target" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-course gradebooks */}
      <div className="space-y-4">
        {courseStats.map(({ course, current, computed, projected }) => {
          const isOverride = course.overallGrade !== null && course.overallGrade !== undefined;

          return (
            <div key={course.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Course header */}
              <div
                className="px-5 py-4"
                style={{ background: course.color + '12', borderBottom: `2px solid ${course.color}30` }}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{ background: course.color + '28' }}>
                      <div className="w-4 h-4 rounded-full" style={{ background: course.color }} />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{course.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                          style={{ background: course.color }}>
                          {course.code}
                        </span>
                        <span className="text-xs text-gray-400">{course.creditHours} cr</span>
                      </div>
                    </div>
                  </div>

                  {/* Overall grade input */}
                  <OverallGradeInput
                    course={course}
                    computedGrade={computed}
                    gradingScale={gradingScale}
                    onUpdateCourse={onUpdateCourse}
                  />
                </div>

                {/* Override notice */}
                {isOverride && computed !== null && (
                  <p className="text-[11px] text-gray-400 mt-2 ml-5">
                    Computed from assignments: {computed.toFixed(1)}% · Override active
                  </p>
                )}
              </div>

              {/* Progress bar */}
              <div className="px-5 pt-3 pb-1">
                <div className="w-full bg-gray-100 rounded-full h-2 relative">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(current ?? 0, 100)}%`, background: course.color }}
                  />
                  <div
                    className="absolute top-0 h-2 w-0.5 bg-gray-400 rounded-full"
                    style={{ left: `${Math.min(course.targetGrade, 100)}%` }}
                    title={`Target: ${course.targetGrade}%`}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>0%</span>
                  <span>Target: {course.targetGrade}%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* ── Assignments accordion ── */}
              {(() => {
                const rows = assignments
                  .filter(a => a.courseId === course.id && a.type !== 'participation')
                  .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
                const isOpen = expandedCourses.has(course.id);
                return (
                  <div className="border-t border-gray-100">
                    {/* Toggle button */}
                    <button
                      onClick={() => toggleCourse(course.id)}
                      className="w-full flex items-center justify-between px-5 py-3 transition-colors text-left"
                      style={{ background: isOpen ? course.color + '1a' : course.color + '0d' }}
                    >
                      <span className="text-sm font-bold flex items-center gap-2" style={{ color: course.color }}>
                        📝 Assignments
                        {rows.length > 0 && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white"
                            style={{ background: course.color }}>
                            {rows.length}
                          </span>
                        )}
                      </span>
                      <ChevronDown
                        size={16}
                        style={{ color: course.color }}
                        className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {/* Expanded content */}
                    {isOpen && (
                      <div className="border-t border-gray-100">
                        {/* Assignment rows */}
                        {rows.length === 0 ? (
                          <div className="px-5 py-4 text-xs text-gray-400">
                            No assignments yet — add them in the Syllabus tab.
                          </div>
                        ) : (
                          rows.map(a => (
                            <GradeRow
                              key={a.id}
                              assignment={a}
                              courseColor={course.color}
                              gradingScale={gradingScale}
                              onUpdate={onUpdate}
                            />
                          ))
                        )}

                        {/* ── Grade calculator ── */}
                        <div className="mx-4 mb-4 mt-2 rounded-xl border border-gray-200 bg-white overflow-hidden">
                          <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-2" style={{ background: course.color + '12' }}>
                            <span className="text-base">🎯</span>
                            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: course.color }}>
                              What do I need?
                            </p>
                          </div>
                          <div className="px-4 py-3">
                            <WhatIfRow
                              courseId={course.id}
                              assignments={assignments}
                              courseColor={course.color}
                              gradingScale={gradingScale}
                              effectiveGrade={current}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Projected final grade — always visible when meaningful */}
              {!isOverride && projected > 0 && (
                <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-2 text-sm">
                  <span className="text-base">📈</span>
                  <span className="text-gray-500">Projected final:</span>
                  <span className="font-bold" style={{ color: course.color }}>{projected.toFixed(1)}%</span>
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded-md" style={{ background: course.color + '20', color: course.color }}>{scoreToLetter(projected, gradingScale)}</span>
                  <span className="text-gray-300 text-xs ml-0.5">at current pace</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Semester GPA History */}
      <GpaHistory
        semesterHistory={semesterHistory}
        currentCourses={courses}
        currentAssignments={assignments}
        gradingScale={gradingScale}
        onAdd={onAddSemester}
        onDelete={onDeleteSemester}
      />
    </div>
  );
}

// ── What-if calculator row ───────────────────────────────────────────────────

function WhatIfRow({ courseId, assignments, courseColor, gradingScale, effectiveGrade }: {
  courseId: string;
  assignments: Assignment[];
  courseColor: string;
  gradingScale: GradingScale;
  effectiveGrade: number | null;
}) {
  const [target, setTarget] = useState<string>('90');

  const result = useMemo(() => {
    const all = assignments.filter(a => a.courseId === courseId && a.type !== 'participation');
    const totalWeight = all.reduce((s, a) => s + a.weight, 0);

    // No assignments added at all — simple above/below check using override grade
    if (all.length === 0 || totalWeight === 0) {
      if (effectiveGrade === null) return null;
      const t = parseFloat(target);
      if (isNaN(t)) return null;
      return { kind: 'simple' as const, above: effectiveGrade >= t };
    }

    let earnedContrib = 0;
    let gradedWeight = 0;
    let remainingWeight = 0;
    for (const a of all) {
      if (a.score !== null) {
        earnedContrib += (a.score / a.maxScore) * a.weight;
        gradedWeight += a.weight;
      } else {
        remainingWeight += a.weight;
      }
    }

    // No individual scores entered yet — can't give a meaningful breakdown
    if (gradedWeight === 0) {
      return { kind: 'no-scores' as const };
    }

    if (remainingWeight <= 0) {
      return { kind: 'locked' as const, needed: 0, remainingWeight: 0 };
    }

    const t = parseFloat(target);
    if (isNaN(t)) return null;

    const needed = (t * totalWeight - earnedContrib * 100) / remainingWeight;
    const pctGraded = Math.round((gradedWeight / totalWeight) * 100);
    return { kind: 'calc' as const, needed, remainingWeight, pctGraded };
  }, [courseId, assignments, target, effectiveGrade]);

  if (!result) return null;

  // "no-scores" state: nudge user to start entering grades
  if (result.kind === 'no-scores') {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Target size={13} className="text-gray-300 flex-shrink-0" />
        <span>Enter scores above to see what you need on remaining work.</span>
      </div>
    );
  }

  const impossible  = result.kind === 'calc' && result.needed > 100;
  const alreadyDone = result.kind === 'calc' && result.needed <= 0;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Target size={13} className="text-navy flex-shrink-0" />
      <span className="text-gray-500 text-sm">To finish with</span>
      <input
        type="number" min={0} max={100} step={0.5}
        value={target}
        onChange={e => setTarget(e.target.value)}
        className="w-16 border border-gray-200 rounded-lg px-2 py-0.5 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-navy/30"
        style={{ color: courseColor }}
      />
      <span className="text-gray-500 text-sm">%</span>
      {result.kind === 'simple' ? (
        result.above
          ? <span className="text-xs font-semibold text-emerald-600">✓ Your current grade already meets this target!</span>
          : <span className="text-xs text-gray-400">Add assignment scores in the Syllabus tab for a detailed breakdown.</span>
      ) : result.kind === 'locked' ? (
        <span className="text-xs text-gray-400 italic">Grade is fully determined — all work graded.</span>
      ) : alreadyDone ? (
        <span className="text-xs font-semibold text-emerald-600">✓ Already locked in — keep it up!</span>
      ) : impossible ? (
        <span className="text-xs font-semibold text-crimson">Not achievable even with perfect scores on remaining work.</span>
      ) : (
        <span className="text-xs text-gray-500">
          → need <span className="font-bold" style={{ color: courseColor }}>{result.needed.toFixed(1)}%</span>
          {' '}on remaining work{' '}
          <span className="text-gray-400">({result.remainingWeight.toFixed(0)}% of grade left · {result.pctGraded}% graded so far)</span>
        </span>
      )}
    </div>
  );
}

// ── Semester GPA history ──────────────────────────────────────────────────────

function GpaHistory({ semesterHistory, currentCourses, currentAssignments, gradingScale, onAdd, onDelete }: {
  semesterHistory: SemesterRecord[];
  currentCourses: Course[];
  currentAssignments: Assignment[];
  gradingScale: GradingScale;
  onAdd: (s: SemesterRecord) => void;
  onDelete: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel]       = useState('');
  const [gpa, setGpa]           = useState('');
  const [credits, setCredits]   = useState('15');

  const currentGpa = useMemo(() => computeGPA(currentCourses, currentAssignments, gradingScale), [currentCourses, currentAssignments, gradingScale]);
  const currentCredits = currentCourses.reduce((s, c) => s + c.creditHours, 0);

  // Cumulative GPA across all past semesters + current
  const allRecords = useMemo(() => {
    const past = semesterHistory.map(s => ({ gpa: s.gpa, credits: s.creditHours }));
    const cur = currentGpa !== null ? [{ gpa: currentGpa, credits: currentCredits }] : [];
    return [...past, ...cur];
  }, [semesterHistory, currentGpa, currentCredits]);

  const cumulativeGpa = useMemo(() => {
    const total = allRecords.reduce((s, r) => s + r.gpa * r.credits, 0);
    const credits = allRecords.reduce((s, r) => s + r.credits, 0);
    return credits > 0 ? total / credits : null;
  }, [allRecords]);

  const totalCredits = allRecords.reduce((s, r) => s + r.credits, 0);

  function submit() {
    const g = parseFloat(gpa);
    const cr = parseInt(credits);
    if (!label.trim() || isNaN(g) || isNaN(cr)) return;
    onAdd({ id: crypto.randomUUID(), label: label.trim(), gpa: g, creditHours: cr });
    setLabel(''); setGpa(''); setCredits('15'); setShowForm(false);
  }

  const inp = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <span className="text-xl">📈</span> GPA History
        </h3>
        <button onClick={() => setShowForm(p => !p)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-navy text-white text-xs font-semibold rounded-lg hover:bg-navy/90 transition-colors">
          <Plus size={12} /> Add semester
        </button>
      </div>

      {showForm && (
        <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-100 flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Semester</label>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Fall 2024" className={`${inp} w-36`} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">GPA</label>
            <input type="number" min={0} max={4} step={0.01} value={gpa} onChange={e => setGpa(e.target.value)} placeholder="3.50" className={`${inp} w-20`} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Credits</label>
            <input type="number" min={1} max={30} value={credits} onChange={e => setCredits(e.target.value)} className={`${inp} w-16`} />
          </div>
          <button onClick={submit} className="px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy/90"><Check size={14} /></button>
          <button onClick={() => setShowForm(false)} className="px-3 py-2 bg-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-300"><X size={14} /></button>
        </div>
      )}

      {semesterHistory.length === 0 && currentGpa === null ? (
        <p className="text-sm text-gray-400 italic">No semester data yet. Add past semesters to track your cumulative GPA.</p>
      ) : (
        <div className="space-y-2">
          {semesterHistory.map(s => (
            <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-50 group">
              <span className="text-sm font-medium text-gray-700">{s.label}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-gray-800">{s.gpa.toFixed(2)}</span>
                <span className="text-xs text-gray-400">{s.creditHours} cr</span>
                <button onClick={() => onDelete(s.id)}
                  className="p-1 text-gray-300 hover:text-crimson rounded opacity-0 group-hover:opacity-100 transition-all">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
          {currentGpa !== null && (
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span className="text-sm font-medium text-navy">Current semester</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-navy">{currentGpa.toFixed(2)}</span>
                <span className="text-xs text-gray-400">{currentCredits} cr</span>
              </div>
            </div>
          )}
          {cumulativeGpa !== null && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-bold text-gray-700">Cumulative GPA</span>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-navy">{cumulativeGpa.toFixed(2)}</span>
                <span className="text-xs text-gray-400">{totalCredits} total credits</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Overall grade override input ─────────────────────────────────────────────

function OverallGradeInput({
  course, computedGrade, gradingScale, onUpdateCourse,
}: {
  course: Course;
  computedGrade: number | null;
  gradingScale: GradingScale;
  onUpdateCourse: (c: Course) => void;
}) {
  const isOverride = course.overallGrade !== null && course.overallGrade !== undefined;
  const displayGrade = isOverride ? course.overallGrade! : computedGrade;
  const letter = displayGrade !== null ? scoreToLetter(displayGrade, gradingScale) : null;
  const gpaPoints = displayGrade !== null ? scoreToGpaPoints(displayGrade, gradingScale) : null;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(
    course.overallGrade !== null && course.overallGrade !== undefined
      ? String(course.overallGrade)
      : ''
  );

  function save() {
    const val = draft.trim() === '' ? null : parseFloat(draft);
    if (val !== null && (isNaN(val) || val < 0 || val > 100)) {
      setEditing(false);
      return;
    }
    onUpdateCourse({ ...course, overallGrade: val });
    setEditing(false);
  }

  function clear() {
    setDraft('');
    onUpdateCourse({ ...course, overallGrade: null });
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') setEditing(false);
  }

  return (
    <div className="flex items-center gap-2">
      {editing ? (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKey}
            onBlur={save}
            placeholder="e.g. 87.5"
            className="w-24 border-2 rounded-xl px-3 py-1.5 text-sm font-bold text-center focus:outline-none"
            style={{ borderColor: course.color, color: course.color }}
          />
          <span className="text-sm text-gray-400 font-medium">%</span>
          <button onMouseDown={save} className="p-1 text-emerald-500 hover:text-emerald-700">
            <Check size={15} />
          </button>
          <button onMouseDown={() => setEditing(false)} className="p-1 text-gray-400 hover:text-gray-600">
            <X size={15} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {displayGrade !== null ? (
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-2xl font-bold leading-none" style={{ color: course.color }}>
                  {displayGrade.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 font-semibold mt-0.5">
                  {letter} &nbsp;·&nbsp; {gpaPoints?.toFixed(2)} pts
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => { setDraft(String(displayGrade.toFixed(1))); setEditing(true); }}
                  className="p-1 text-gray-300 hover:text-gray-600 transition-colors"
                  title="Edit overall grade"
                >
                  <Pencil size={12} />
                </button>
                {isOverride && (
                  <button
                    onClick={clear}
                    className="p-1 text-gray-300 hover:text-crimson transition-colors"
                    title="Clear override — use computed grade"
                  >
                    <RotateCcw size={12} />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setDraft(''); setEditing(true); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed text-sm font-medium transition-colors hover:border-opacity-80"
              style={{ borderColor: course.color + '60', color: course.color + 'aa' }}
            >
              <Pencil size={13} />
              Enter your grade
            </button>
          )}
        </div>
      )}
    </div>
  );
}


// ── Inline assignment score row ───────────────────────────────────────────────

function GradeRow({ assignment, courseColor, gradingScale, onUpdate }: {
  assignment: Assignment;
  courseColor: string;
  gradingScale: GradingScale;
  onUpdate: (a: Assignment) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(assignment.score !== null ? String(assignment.score) : '');

  const pct    = assignment.score !== null ? (assignment.score / assignment.maxScore) * 100 : null;
  const letter = pct !== null ? scoreToLetter(pct, gradingScale) : null;

  function save() {
    const val = draft.trim() === '' ? null : Number(draft);
    if (val !== null && (isNaN(val) || val < 0)) { setEditing(false); return; }
    onUpdate({ ...assignment, score: val });
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-3 px-5 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 truncate">{assignment.title}</p>
        <p className="text-[11px] text-gray-400 capitalize">{assignment.type} · {assignment.weight}% of grade</p>
      </div>

      {editing ? (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            type="number" min={0} max={assignment.maxScore}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            className="w-16 border border-navy/30 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-navy/30"
          />
          <span className="text-xs text-gray-400">/ {assignment.maxScore}</span>
          <button onMouseDown={save} className="p-0.5 text-emerald-500 hover:text-emerald-700"><Check size={13} /></button>
          <button onMouseDown={() => setEditing(false)} className="p-0.5 text-gray-400 hover:text-gray-600"><X size={13} /></button>
        </div>
      ) : (
        <button
          onClick={() => { setDraft(assignment.score !== null ? String(assignment.score) : ''); setEditing(true); }}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm border transition-colors ${
            assignment.score !== null
              ? 'border-gray-200 text-gray-700 hover:border-navy/30 hover:bg-navy/5'
              : 'border-dashed border-gray-300 text-gray-400 hover:border-navy/40 hover:text-navy'
          }`}
        >
          {assignment.score !== null ? (
            <>
              <span className="font-semibold">{assignment.score}</span>
              <span className="text-gray-400 text-xs">/ {assignment.maxScore}</span>
              <Pencil size={10} className="ml-1 text-gray-300" />
            </>
          ) : (
            <span className="text-xs">+ score</span>
          )}
        </button>
      )}

      <div className="w-9 text-center flex-shrink-0">
        {letter ? (
          <span className="text-xs font-bold px-1.5 py-0.5 rounded-md"
            style={{ background: courseColor + '20', color: courseColor }}>
            {letter}
          </span>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </div>
    </div>
  );
}

function gpaLabel(gpa: number): string {
  if (gpa >= 3.85) return "Dean's List territory";
  if (gpa >= 3.5)  return 'Strong performance';
  if (gpa >= 3.0)  return 'On track';
  if (gpa >= 2.5)  return 'Needs attention';
  return 'At risk — prioritize study time';
}
