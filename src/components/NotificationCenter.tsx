import { useState, useEffect, useRef, useMemo } from 'react';
import { Bell, X, AlertTriangle, Clock, TrendingDown, BookX, ChevronRight } from 'lucide-react';
import { differenceInCalendarDays, parseISO, format, subDays } from 'date-fns';
import type { Course, Assignment, StudyBlock } from '../types';
import { computeCurrentGrade } from '../scheduler';

type Tab = 'dashboard' | 'study-plan' | 'courses' | 'assignments' | 'schedule' | 'grades' | 'help';

interface Props {
  courses: Course[];
  assignments: Assignment[];
  studyBlocks: StudyBlock[];
  today: Date;
  onNavigate: (tab: Tab) => void;
}

type NotifType = 'overdue' | 'due-soon' | 'missed-block' | 'grade-warning';

interface Notification {
  id: string;
  type: NotifType;
  title: string;
  subtitle: string;
  courseColor: string;
  courseCode: string;
  action: Tab;
  severity: 'high' | 'medium' | 'low';
}

const DISMISSED_KEY = 'syllabros_dismissed_notifs';
const DISMISS_TTL_DAYS = 3; // dismissed notifications resurface after N days

function loadDismissed(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '{}'); }
  catch { return {}; }
}

function saveDismissed(map: Record<string, string>) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(map));
}

function pruneDismissed(map: Record<string, string>, today: Date): Record<string, string> {
  const todayStr = format(today, 'yyyy-MM-dd');
  const out: Record<string, string> = {};
  for (const [id, dateStr] of Object.entries(map)) {
    const age = differenceInCalendarDays(parseISO(todayStr), parseISO(dateStr));
    if (age < DISMISS_TTL_DAYS) out[id] = dateStr;
  }
  return out;
}

function severityOrder(s: Notification['severity']) {
  return s === 'high' ? 0 : s === 'medium' ? 1 : 2;
}

export default function NotificationCenter({ courses, assignments, studyBlocks, today, onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Record<string, string>>(() => {
    const raw = loadDismissed();
    return pruneDismissed(raw, today);
  });
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const todayStr = format(today, 'yyyy-MM-dd');

  const allNotifs = useMemo((): Notification[] => {
    const out: Notification[] = [];

    // ── Overdue assignments ───────────────────────────────────────
    for (const a of assignments) {
      if (a.score !== null) continue;
      if (a.type === 'participation') continue;
      const daysLate = differenceInCalendarDays(today, parseISO(a.dueDate));
      if (daysLate <= 0) continue;
      const course = courses.find(c => c.id === a.courseId);
      out.push({
        id: `overdue-${a.id}`,
        type: 'overdue',
        title: `${a.title} is overdue`,
        subtitle: `${daysLate} day${daysLate !== 1 ? 's' : ''} late · ${a.weight}% of grade`,
        courseColor: course?.color ?? '#aaa',
        courseCode: course?.code ?? '',
        action: 'assignments',
        severity: 'high',
      });
    }

    // ── Due soon (today + 3 days) ─────────────────────────────────
    for (const a of assignments) {
      if (a.score !== null) continue;
      if (a.type === 'participation') continue;
      const daysUntil = differenceInCalendarDays(parseISO(a.dueDate), today);
      if (daysUntil < 0 || daysUntil > 3) continue;
      const course = courses.find(c => c.id === a.courseId);
      const when = daysUntil === 0 ? 'Due today' : daysUntil === 1 ? 'Due tomorrow' : `Due in ${daysUntil} days`;
      out.push({
        id: `due-soon-${a.id}`,
        type: 'due-soon',
        title: a.title,
        subtitle: `${when} · ${a.weight}% of grade`,
        courseColor: course?.color ?? '#aaa',
        courseCode: course?.code ?? '',
        action: 'assignments',
        severity: daysUntil === 0 ? 'high' : 'medium',
      });
    }

    // ── Missed study blocks (last 3 days, excluding today) ────────
    const cutoff = format(subDays(today, 3), 'yyyy-MM-dd');
    for (const b of studyBlocks) {
      if (b.isCompleted) continue;
      if (b.date >= todayStr || b.date < cutoff) continue;
      const course = courses.find(c => c.id === b.courseId);
      const when = format(parseISO(b.date), 'EEE MMM d');
      out.push({
        id: `missed-${b.id}`,
        type: 'missed-block',
        title: 'Missed study session',
        subtitle: `${when} · ${b.duration} min · ${course?.code ?? ''}`,
        courseColor: course?.color ?? '#aaa',
        courseCode: course?.code ?? '',
        action: 'study-plan',
        severity: 'low',
      });
    }

    // ── Grade warnings ─────────────────────────────────────────────
    for (const c of courses) {
      const grade = computeCurrentGrade(c.id, assignments);
      if (grade === null) continue; // no graded assignments yet
      if (grade >= c.targetGrade) continue;
      const gap = (c.targetGrade - grade).toFixed(1);
      out.push({
        id: `grade-warn-${c.id}`,
        type: 'grade-warning',
        title: `${c.code} grade is below target`,
        subtitle: `${grade.toFixed(1)}% current · ${c.targetGrade}% target · ${gap}% gap`,
        courseColor: c.color,
        courseCode: c.code,
        action: 'grades',
        severity: Number(gap) >= 10 ? 'high' : 'medium',
      });
    }

    // Sort by severity then filter dismissed
    return out.sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity));
  }, [courses, assignments, studyBlocks, today, todayStr]);

  const visible = useMemo(
    () => allNotifs.filter(n => !dismissed[n.id]),
    [allNotifs, dismissed]
  );

  function dismiss(id: string) {
    const updated = { ...dismissed, [id]: todayStr };
    setDismissed(updated);
    saveDismissed(updated);
  }

  function dismissAll() {
    const updated = { ...dismissed };
    for (const n of visible) updated[n.id] = todayStr;
    setDismissed(updated);
    saveDismissed(updated);
  }

  function handleAction(n: Notification) {
    onNavigate(n.action);
    setOpen(false);
  }

  const count = visible.length;
  const hasCritical = visible.some(n => n.severity === 'high');

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`relative p-1.5 rounded-lg transition-colors ${
          open ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
        }`}
        title={`${count} notification${count !== 1 ? 's' : ''}`}
      >
        <Bell size={15} />
        {count > 0 && (
          <span
            className={`absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full text-[9px] font-bold flex items-center justify-center px-0.5 text-white ${
              hasCritical ? 'bg-crimson animate-pulse' : 'bg-amber-warm'
            }`}
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div>
              <p className="font-bold text-gray-800 text-sm">Notifications</p>
              {count === 0
                ? <p className="text-xs text-gray-400">You're all caught up! 🎉</p>
                : <p className="text-xs text-gray-400">{count} item{count !== 1 ? 's' : ''} need attention</p>
              }
            </div>
            {count > 0 && (
              <button
                onClick={dismissAll}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Dismiss all
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-[400px] overflow-y-auto">
            {visible.length === 0 ? (
              <div className="py-10 text-center">
                <div className="text-4xl mb-2">✅</div>
                <p className="text-sm font-medium text-gray-600">All clear!</p>
                <p className="text-xs text-gray-400 mt-0.5">No outstanding items right now</p>
              </div>
            ) : (
              <div>
                {visible.map((n, i) => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group ${
                      i < visible.length - 1 ? 'border-b border-gray-50' : ''
                    }`}
                  >
                    {/* Icon */}
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: n.courseColor + '20' }}
                    >
                      <NotifIcon type={n.type} color={n.courseColor} />
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-1">
                        <p className="text-xs font-semibold text-gray-800 leading-tight flex-1">{n.title}</p>
                        {n.severity === 'high' && (
                          <span className="text-[9px] font-bold bg-crimson/10 text-crimson px-1.5 py-0.5 rounded-full flex-shrink-0">
                            URGENT
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">{n.subtitle}</p>
                      <button
                        onClick={() => handleAction(n)}
                        className="mt-1.5 text-[11px] font-semibold flex items-center gap-0.5 transition-colors hover:underline"
                        style={{ color: n.courseColor }}
                      >
                        View <ChevronRight size={10} />
                      </button>
                    </div>

                    {/* Dismiss */}
                    <button
                      onClick={() => dismiss(n.id)}
                      className="p-1 text-gray-300 hover:text-gray-500 rounded transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                      title="Dismiss"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer hint */}
          {visible.length > 0 && (
            <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100">
              <p className="text-[10px] text-gray-400">
                Dismissed items reappear after {DISMISS_TTL_DAYS} days if unresolved
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotifIcon({ type, color }: { type: NotifType; color: string }) {
  const cls = 'w-4 h-4';
  switch (type) {
    case 'overdue':       return <BookX       className={cls} style={{ color }} />;
    case 'due-soon':      return <AlertTriangle className={cls} style={{ color }} />;
    case 'missed-block':  return <Clock        className={cls} style={{ color }} />;
    case 'grade-warning': return <TrendingDown  className={cls} style={{ color }} />;
  }
}
