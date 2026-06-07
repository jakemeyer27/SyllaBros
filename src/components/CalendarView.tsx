import { useState, useMemo } from 'react';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay, parseISO,
  differenceInCalendarDays, isBefore,
} from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays, List } from 'lucide-react';
import type { Course, Assignment, StudyBlock } from '../types';

interface Props {
  courses: Course[];
  assignments: Assignment[];
  studyBlocks: StudyBlock[];
  today: Date;
  completedIds: Set<string>;
}

const TYPE_EMOJI: Record<string, string> = {
  exam: '🎯', quiz: '⚡', homework: '📚',
  project: '🎨', participation: '👋', other: '📌',
};
const TYPE_LABEL: Record<string, string> = {
  exam: 'Exam', quiz: 'Quiz', homework: 'HW',
  project: 'Project', participation: 'Participation', other: 'Other',
};

export default function CalendarView({ courses, assignments, studyBlocks, today, completedIds }: Props) {
  const [currentMonth, setCurrentMonth] = useState(today);
  const [selectedDate, setSelectedDate] = useState(format(today, 'yyyy-MM-dd'));
  const [viewMode, setViewMode] = useState<'month' | 'agenda'>('month');

  // ── Lookups ───────────────────────────────────────────────────────────────
  const courseMap = useMemo(
    () => Object.fromEntries(courses.map(c => [c.id, c])),
    [courses]
  );

  const byDate = useMemo(() => {
    const map: Record<string, Assignment[]> = {};
    for (const a of assignments) {
      (map[a.dueDate] ??= []).push(a);
    }
    return map;
  }, [assignments]);

  // ── Month grid ────────────────────────────────────────────────────────────
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
    const end   = endOfWeek(endOfMonth(currentMonth),   { weekStartsOn: 0 });
    const days: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
    return days;
  }, [currentMonth]);

  // ── Agenda ────────────────────────────────────────────────────────────────
  const agendaItems = useMemo(() => {
    const items: { date: string; list: Assignment[] }[] = [];
    for (let i = -7; i < 100; i++) {
      const d = addDays(today, i);
      const key = format(d, 'yyyy-MM-dd');
      if (byDate[key]?.length) items.push({ date: key, list: byDate[key] });
    }
    return items;
  }, [byDate, today]);

  const todayStr    = format(today, 'yyyy-MM-dd');
  const selDate     = parseISO(selectedDate);
  const selItems    = byDate[selectedDate] ?? [];
  const selBlocks   = studyBlocks.filter(b => b.date === selectedDate);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl select-none">🗓️</span>
          <h1 className="text-xl font-black text-navy">Calendar</h1>
          <span className="hidden sm:block text-xs text-gray-400 font-medium">
            {assignments.length} assignment{assignments.length !== 1 ? 's' : ''} across {courses.length} course{courses.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* View toggle */}
        <div className="flex p-0.5 bg-gray-100 rounded-xl gap-0.5">
          <button
            onClick={() => setViewMode('month')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              viewMode === 'month' ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <CalendarDays size={12} /> Month
          </button>
          <button
            onClick={() => setViewMode('agenda')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              viewMode === 'agenda' ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <List size={12} /> Agenda
          </button>
        </div>
      </div>

      {/* ── Month view ──────────────────────────────────────────────────── */}
      {viewMode === 'month' && (
        <div className="grid md:grid-cols-[1fr_260px] gap-4 items-start">

          {/* Calendar grid */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

            {/* Nav bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <button
                onClick={() => setCurrentMonth(m => subMonths(m, 1))}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft size={16} className="text-gray-500" />
              </button>

              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-800">
                  {format(currentMonth, 'MMMM yyyy')}
                </span>
                {!isSameMonth(today, currentMonth) && (
                  <button
                    onClick={() => { setCurrentMonth(today); setSelectedDate(todayStr); }}
                    className="text-[10px] font-black text-navy px-2 py-0.5 rounded-full bg-navy/10 hover:bg-navy/20 transition-colors uppercase tracking-wide"
                  >
                    Today
                  </button>
                )}
              </div>

              <button
                onClick={() => setCurrentMonth(m => addMonths(m, 1))}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronRight size={16} className="text-gray-500" />
              </button>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 bg-gray-50/60 border-b border-gray-50">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                <div key={d} className="py-2 text-center text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, idx) => {
                const key        = format(day, 'yyyy-MM-dd');
                const dayItems   = byDate[key] ?? [];
                const inMonth    = isSameMonth(day, currentMonth);
                const isSelected = key === selectedDate;
                const isT        = isSameDay(day, today);
                const shown      = dayItems.slice(0, 2);
                const extra      = dayItems.length - shown.length;
                const hasOverdue = dayItems.some(
                  a => isBefore(day, today) && !isSameDay(day, today)
                    && a.score === null && !completedIds.has(a.id)
                );

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedDate(key)}
                    className={`min-h-[76px] p-1 text-left transition-colors border-b border-r border-gray-50 ${
                      isSelected
                        ? 'bg-navy/[0.06] ring-1 ring-inset ring-navy/20'
                        : 'hover:bg-gray-50'
                    } ${!inMonth ? 'opacity-30' : ''}`}
                  >
                    {/* Date number */}
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold mb-0.5 ${
                      isT ? 'bg-navy text-white' : isSelected ? 'text-navy' : 'text-gray-700'
                    }`}>
                      {format(day, 'd')}
                    </div>

                    {/* Assignment chips */}
                    <div className="space-y-0.5">
                      {shown.map(a => {
                        const c       = courseMap[a.courseId];
                        const done    = completedIds.has(a.id);
                        const overdue = !done && isBefore(day, today) && !isSameDay(day, today) && a.score === null;
                        return (
                          <div
                            key={a.id}
                            className={`text-[9px] font-semibold px-1 py-px rounded truncate leading-tight ${done ? 'line-through opacity-50' : ''}`}
                            style={{
                              background: (c?.color ?? '#6b7280') + (overdue ? '30' : '1e'),
                              color:      overdue ? '#C4202A' : (c?.color ?? '#6b7280'),
                            }}
                          >
                            {done ? '✓' : TYPE_EMOJI[a.type]} {a.title}
                          </div>
                        );
                      })}
                      {extra > 0 && (
                        <div className="text-[9px] text-gray-400 font-semibold px-1">
                          +{extra} more
                        </div>
                      )}
                    </div>

                    {/* Overdue indicator dot */}
                    {hasOverdue && (
                      <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-crimson" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Course color legend */}
            {courses.length > 0 && (
              <div className="px-4 py-2.5 border-t border-gray-50 flex flex-wrap gap-x-3 gap-y-1">
                {courses.map(c => (
                  <span key={c.id} className="flex items-center gap-1 text-[10px] font-semibold text-gray-500">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                    {c.code}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ── Day detail panel ─────────────────────────────────────────── */}
          <DayDetailPanel
            date={selDate}
            assignments={selItems}
            studyBlocks={selBlocks}
            courseMap={courseMap}
            today={today}
            completedIds={completedIds}
          />
        </div>
      )}

      {/* ── Agenda view ─────────────────────────────────────────────────── */}
      {viewMode === 'agenda' && (
        <div className="space-y-2">
          {assignments.length === 0 ? (
            <EmptyState
              icon="📭"
              title="No assignments yet"
              sub="Import a syllabus or add assignments manually to see them here"
            />
          ) : agendaItems.length === 0 ? (
            <EmptyState icon="🎉" title="Clear horizon" sub="No assignments in the next 100 days" />
          ) : (
            agendaItems.map(({ date, list }) => {
              const d       = parseISO(date);
              const isPast  = isBefore(d, today) && !isSameDay(d, today);
              const daysOut = differenceInCalendarDays(d, today);
              const isT     = isSameDay(d, today);

              return (
                <div
                  key={date}
                  className={`bg-white rounded-2xl border overflow-hidden ${
                    isT ? 'border-navy/25 shadow-sm' : 'border-gray-100'
                  }`}
                >
                  {/* Date header */}
                  <div className={`flex items-center justify-between px-4 py-2.5 border-b border-gray-50 ${
                    isT ? 'bg-navy/5' : isPast ? 'bg-gray-50/60' : ''
                  }`}>
                    <div className="flex items-center gap-2">
                      {isT && (
                        <span className="text-[10px] font-black bg-navy text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
                          Today
                        </span>
                      )}
                      <span className={`text-sm font-bold ${isPast ? 'text-gray-400' : 'text-gray-800'}`}>
                        {format(d, 'EEE, MMM d')}
                      </span>
                    </div>
                    <span className={`text-xs font-semibold tabular-nums ${
                      daysOut < 0  ? 'text-gray-300' :
                      daysOut === 0 ? 'text-navy font-black' :
                      daysOut <= 2  ? 'text-crimson' :
                      daysOut <= 7  ? 'text-brand-orange' : 'text-gray-400'
                    }`}>
                      {daysOut < 0  ? `${Math.abs(daysOut)}d ago` :
                       daysOut === 0 ? 'Due today' :
                       daysOut === 1 ? 'Tomorrow' :
                       `In ${daysOut}d`}
                    </span>
                  </div>

                  {/* Assignments */}
                  <div className="divide-y divide-gray-50">
                    {list.map(a => {
                      const c       = courseMap[a.courseId];
                      const done    = completedIds.has(a.id);
                      const overdue = isPast && a.score === null && !done;
                      return (
                        <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: c?.color ?? '#9ca3af' }}
                          />
                          <span className={`flex-1 text-sm font-medium truncate ${
                            done ? 'line-through text-gray-400' : isPast ? 'text-gray-500' : 'text-gray-800'
                          }`}>
                            {done ? '✓' : TYPE_EMOJI[a.type]} {a.title}
                          </span>
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{
                              background: (c?.color ?? '#083152') + '18',
                              color: c?.color ?? '#083152',
                            }}
                          >
                            {c?.code ?? '?'}
                          </span>
                          {a.weight != null && a.weight > 0 && (
                            <span className="text-[11px] text-gray-400 flex-shrink-0 font-medium hidden sm:block">
                              {a.weight}%
                            </span>
                          )}
                          {done && (
                            <span className="text-[10px] font-bold text-emerald-500 flex-shrink-0">submitted</span>
                          )}
                          {!done && overdue && (
                            <span className="text-[10px] font-bold text-crimson flex-shrink-0">overdue</span>
                          )}
                          {!done && a.score !== null && (
                            <span className="text-[10px] font-bold text-emerald-600 flex-shrink-0">✓ graded</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── Day detail side panel ─────────────────────────────────────────────────

function DayDetailPanel({ date, assignments, studyBlocks, courseMap, today, completedIds }: {
  date: Date;
  assignments: Assignment[];
  studyBlocks: StudyBlock[];
  courseMap: Record<string, Course>;
  today: Date;
  completedIds: Set<string>;
}) {
  const isT         = isSameDay(date, today);
  const totalMins   = studyBlocks.reduce((s, b) => s + b.duration, 0);
  const doneMins    = studyBlocks.filter(b => b.isCompleted).reduce((s, b) => s + b.duration, 0);
  const isPast      = isBefore(date, today) && !isT;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden sticky top-4">
      {/* Header */}
      <div className={`px-4 py-3 ${isT ? 'bg-navy' : 'bg-gray-50'}`}>
        <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${
          isT ? 'text-white/50' : 'text-gray-400'
        }`}>
          {isT ? '⭐ Today' : format(date, 'EEEE')}
        </p>
        <p className={`text-lg font-black leading-tight ${isT ? 'text-white' : 'text-gray-800'}`}>
          {format(date, 'MMMM d')}
        </p>
        {assignments.length > 0 && (
          <p className={`text-xs mt-0.5 font-medium ${isT ? 'text-white/60' : 'text-gray-400'}`}>
            {assignments.length} item{assignments.length !== 1 ? 's' : ''} due
          </p>
        )}
      </div>

      {/* Body */}
      <div className="p-4 space-y-4 max-h-[480px] overflow-y-auto">
        {assignments.length === 0 && studyBlocks.length === 0 ? (
          <div className="text-center py-8">
            <span className="text-3xl select-none">✨</span>
            <p className="text-sm font-semibold text-gray-400 mt-2">Nothing due</p>
            <p className="text-xs text-gray-300 mt-0.5">Free day!</p>
          </div>
        ) : (
          <>
            {/* Assignments */}
            {assignments.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  📋 Due ({assignments.length})
                </p>
                {assignments.map(a => {
                  const c       = courseMap[a.courseId];
                  const done    = completedIds.has(a.id);
                  const overdue = isPast && a.score === null && !done;
                  return (
                    <div
                      key={a.id}
                      className={`rounded-xl p-3 ${done ? 'opacity-60' : ''}`}
                      style={{ background: (c?.color ?? '#083152') + '0f' }}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <p
                          className={`text-sm font-bold leading-snug ${done ? 'line-through' : ''}`}
                          style={{ color: done ? '#9ca3af' : (c?.color ?? '#083152') }}
                        >
                          {done ? '✓' : TYPE_EMOJI[a.type]} {a.title}
                        </p>
                        {a.weight != null && a.weight > 0 && (
                          <span
                            className="text-[10px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0 text-white"
                            style={{ background: c?.color ?? '#083152' }}
                          >
                            {a.weight}%
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[11px] text-gray-500">
                          {c?.code ?? '?'} · {TYPE_LABEL[a.type]}
                        </span>
                        {a.score !== null && (
                          <span className="text-[11px] font-semibold text-emerald-600">
                            ✓ {a.score}/{a.maxScore}
                          </span>
                        )}
                        {overdue && (
                          <span className="text-[11px] font-semibold text-crimson">Overdue</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Study blocks */}
            {studyBlocks.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                  ⏱️ Study Blocks
                </p>
                <div className="space-y-1.5 mb-2">
                  {studyBlocks.map(b => {
                    const c = courseMap[b.courseId];
                    return (
                      <div key={b.id} className="flex items-center gap-2 text-xs">
                        <span className={`w-3 h-3 rounded-full flex-shrink-0 flex items-center justify-center text-[8px] font-black ${
                          b.isCompleted ? 'bg-emerald-500 text-white' : 'bg-gray-100'
                        }`}>
                          {b.isCompleted ? '✓' : ''}
                        </span>
                        <span className={b.isCompleted ? 'line-through text-gray-400' : 'text-gray-700'}>
                          {c?.code ?? '?'} — {b.duration}min
                        </span>
                      </div>
                    );
                  })}
                </div>
                {totalMins > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 rounded-full transition-all"
                        style={{ width: `${(doneMins / totalMins) * 100}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-gray-500 font-medium tabular-nums">
                      {doneMins}/{totalMins}min
                    </span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Reusable empty state ──────────────────────────────────────────────────

function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
      <span className="text-4xl select-none">{icon}</span>
      <p className="font-bold text-gray-500 mt-3">{title}</p>
      <p className="text-sm text-gray-400 mt-1">{sub}</p>
    </div>
  );
}
