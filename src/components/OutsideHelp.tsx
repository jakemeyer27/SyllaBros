import { useState } from 'react';
import { MapPin, Clock, GraduationCap, AlertTriangle, CheckCircle2, Plus, Trash2, X, Check, XCircle, BookOpen } from 'lucide-react';
import { differenceInDays, parseISO, addDays } from 'date-fns';
import type { Course, Assignment, OfficeHours, OfficeHoursRole, ClassMeeting, StudyBlock } from '../types';

interface Props {
  courses: Course[];
  assignments: Assignment[];
  officeHours: OfficeHours[];
  today: Date;
  onAddOfficeHours: (ohs: OfficeHours[]) => void;
  onDeleteOfficeHours: (id: string) => void;
  classMeetings: ClassMeeting[];
  studyBlocks: StudyBlock[];
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function fmt12(time: string) {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
}

const ROLE_LABELS: Record<OfficeHoursRole, string> = {
  professor: 'Professor',
  ta: 'Teaching Assistant',
  other: 'Instructor',
};

const ROLE_COLORS: Record<OfficeHoursRole, string> = {
  professor: 'bg-navy text-white',
  ta: 'bg-brand-orange text-white',
  other: 'bg-gray-500 text-white',
};

interface FormData {
  courseId: string;
  personName: string;
  role: OfficeHoursRole;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location: string;
}

const emptyForm = (courseId = ''): FormData => ({
  courseId,
  personName: '',
  role: 'professor',
  dayOfWeek: 1,
  startTime: '10:00',
  endTime: '11:00',
  location: '',
});

// ── Time helpers ────────────────────────────────────────────────────────────

function timeToMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function overlaps(s1: string, e1: string, s2: string, e2: string): boolean {
  return timeToMins(s1) < timeToMins(e2) && timeToMins(s2) < timeToMins(e1);
}

// Availability assessment — two-step check
interface Availability {
  status: 'conflict' | 'busy' | 'has-work' | 'free';
  headline: string;
  detail: string;
}

function assess(
  oh: OfficeHours,
  courses: Course[],
  classMeetings: ClassMeeting[],
  assignments: Assignment[],
  studyBlocks: StudyBlock[],
  today: Date,
): Availability {

  // ── Step 1: does this slot overlap any class on the same day of week? ───────
  const conflictingClasses = classMeetings.filter(cm =>
    cm.dayOfWeek === oh.dayOfWeek &&
    overlaps(oh.startTime, oh.endTime, cm.startTime, cm.endTime)
  );
  if (conflictingClasses.length > 0) {
    const names = conflictingClasses
      .map(cm => {
        const c = courses.find(x => x.id === cm.courseId);
        return `${c?.code ?? 'class'} (${fmt12(cm.startTime)}–${fmt12(cm.endTime)})`;
      })
      .join(', ');
    return {
      status: 'conflict',
      headline: "Can't attend — you have class",
      detail: `Overlaps with ${names}`,
    };
  }

  // ── Step 2: check assignment workload on upcoming occurrences of this day ───
  // Collect the next 4 dates that fall on this day of week
  const upcomingDates: string[] = [];
  for (let i = 1; i <= 28; i++) {
    const d = addDays(today, i);
    if (d.getDay() === oh.dayOfWeek) upcomingDates.push(d.toISOString().slice(0, 10));
    if (upcomingDates.length >= 4) break;
  }

  // All ungraded assignments due on any of those dates (across ALL courses)
  const dueThatDay = assignments.filter(a =>
    a.score === null &&
    a.type !== 'participation' &&
    upcomingDates.includes(a.dueDate)
  );

  // Study blocks already on those dates
  const blocksThatDay = studyBlocks.filter(b => upcomingDates.includes(b.date));
  const blockMins = blocksThatDay.reduce((s, b) => s + b.duration, 0);

  const highStake = dueThatDay.filter(a => a.weight >= 15 || a.type === 'exam');
  const regular   = dueThatDay.filter(a => a.weight < 15 && a.type !== 'exam');

  // Build a short readable list of what's due
  function dueList(items: typeof dueThatDay, max = 2): string {
    const names = items.slice(0, max).map(a => {
      const c = courses.find(x => x.id === a.courseId);
      return `${c?.code ?? ''} ${a.title}`.trim();
    });
    const extra = items.length - max;
    return names.join(', ') + (extra > 0 ? ` +${extra} more` : '');
  }

  if (highStake.length > 0) {
    return {
      status: 'busy',
      headline: `${highStake.length} high-stakes item${highStake.length > 1 ? 's' : ''} due that day`,
      detail: `${dueList(highStake)} — good time to get help before it's due`,
    };
  }
  if (regular.length > 0) {
    return {
      status: 'has-work',
      headline: `${regular.length} assignment${regular.length > 1 ? 's' : ''} due that day`,
      detail: dueList(regular),
    };
  }
  if (blockMins > 0) {
    return {
      status: 'has-work',
      headline: `${Math.round(blockMins / 60 * 10) / 10}h of study blocks scheduled`,
      detail: `You already have study sessions on ${DAYS_FULL[oh.dayOfWeek]}s — attending fits naturally`,
    };
  }

  return {
    status: 'free',
    headline: 'Good time to attend',
    detail: `No classes, assignments, or study sessions conflict on ${DAYS_FULL[oh.dayOfWeek]}s`,
  };
}

export default function OutsideHelp({ courses, assignments, officeHours, today, onAddOfficeHours, onDeleteOfficeHours, classMeetings, studyBlocks }: Props) {
  const [activeCourse, setActiveCourse] = useState(courses[0]?.id ?? '');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormData>(emptyForm(courses[0]?.id ?? ''));

  const courseIds = courses.map(c => c.id);
  const safeActive = courseIds.includes(activeCourse) ? activeCourse : (courses[0]?.id ?? '');
  const course = courses.find(c => c.id === safeActive);

  const courseOH = officeHours.filter(oh => oh.courseId === safeActive)
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));

  // Upcoming assignments for this course (next 30 days)
  const upcoming = assignments
    .filter(a => a.courseId === safeActive && a.score === null)
    .map(a => ({ ...a, daysLeft: differenceInDays(parseISO(a.dueDate), today) }))
    .filter(a => a.daysLeft >= 0 && a.daysLeft <= 30)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  function submit() {
    if (!form.personName.trim() || !form.courseId) return;
    onAddOfficeHours([{ ...form, id: crypto.randomUUID() }]);
    setForm(emptyForm(safeActive));
    setShowForm(false);
  }

  if (courses.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <GraduationCap size={36} className="mx-auto mb-3 opacity-30" />
        <p className="font-medium">No courses yet</p>
        <p className="text-sm">Add courses first, then import syllabi to populate office hours.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <span className="text-xl">🙋</span> Outside Help
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">Office hours & study resources</p>
        </div>
        <button
          onClick={() => { setForm(emptyForm(safeActive)); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-navy text-white text-sm rounded-lg hover:bg-navy/90 transition-colors"
        >
          <Plus size={15} /> Add Hours
        </button>
      </div>

      {/* Color legend */}
      <div className="flex flex-wrap gap-2 px-4 py-3 bg-gray-50 rounded-2xl border border-gray-100">
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide self-center mr-1">🔑 Key:</span>
        {([
          { color: '#ef4444', bg: '#fef2f2', border: '#fecaca', label: "Can't attend — class overlap" },
          { color: '#f97316', bg: '#fff7ed', border: '#fed7aa', label: 'High-stakes work due' },
          { color: '#ca8a04', bg: '#fefce8', border: '#fde68a', label: 'Assignments due that day' },
          { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'Schedule is open' },
        ] as const).map(({ color, bg, border, label }) => (
          <div
            key={label}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border"
            style={{ background: bg, borderColor: border, color }}
          >
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
            {label}
          </div>
        ))}
      </div>

      {/* Course tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {courses.map(c => {
          const count = officeHours.filter(oh => oh.courseId === c.id).length;
          const isActive = safeActive === c.id;
          return (
            <button
              key={c.id}
              onClick={() => { setActiveCourse(c.id); setShowForm(false); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all border-2 ${
                isActive ? 'text-white border-transparent shadow-sm' : 'bg-white text-gray-500 border-gray-100 hover:border-gray-200'
              }`}
              style={isActive ? { background: c.color, borderColor: c.color } : {}}
            >
              {c.code}
              {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Course header */}
      {course && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: course.color + '18' }}>
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: course.color }} />
          <p className="font-semibold text-gray-800 text-sm">{course.code} &mdash; {course.name}</p>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="bg-white border border-navy/10 rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-4">Add Office Hours</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Course">
              <select value={form.courseId} onChange={e => setForm(f => ({ ...f, courseId: e.target.value }))} className={inp}>
                {courses.map(c => <option key={c.id} value={c.id}>{c.code} &mdash; {c.name}</option>)}
              </select>
            </Field>
            <Field label="Person Name">
              <input value={form.personName} onChange={e => setForm(f => ({ ...f, personName: e.target.value }))}
                placeholder="e.g. Dr. Smith or John (TA)" className={inp} />
            </Field>
            <Field label="Role">
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as OfficeHoursRole }))} className={inp}>
                <option value="professor">Professor</option>
                <option value="ta">Teaching Assistant (TA)</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Day of Week">
              <select value={form.dayOfWeek} onChange={e => setForm(f => ({ ...f, dayOfWeek: Number(e.target.value) }))} className={inp}>
                {DAYS_FULL.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </Field>
            <Field label="Start Time">
              <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} className={inp} />
            </Field>
            <Field label="End Time">
              <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} className={inp} />
            </Field>
            <Field label="Location" >
              <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder="e.g. Dallas Hall 201 or Zoom" className={inp} />
            </Field>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={submit} className="flex items-center gap-1 px-4 py-2 bg-navy text-white text-sm rounded-lg hover:bg-navy/90">
              <Check size={14} /> Add
            </button>
            <button onClick={() => setShowForm(false)} className="flex items-center gap-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* No office hours */}
      {courseOH.length === 0 && !showForm ? (
        <div className="text-center py-14 bg-white rounded-3xl border border-gray-100">
          <div className="text-5xl mb-3">🕐</div>
          <p className="font-bold text-gray-700">No office hours for {course?.code}</p>
          <p className="text-sm mt-1 text-gray-400">Import a syllabus with office hours info, or click <strong>Add Hours</strong> above.</p>
        </div>
      ) : (
        <div className="space-y-4">

          {/* Office hours cards — grouped by person */}
          {(() => {
            const byPerson = new Map<string, OfficeHours[]>();
            for (const oh of courseOH) {
              const key = `${oh.personName}__${oh.role}`;
              if (!byPerson.has(key)) byPerson.set(key, []);
              byPerson.get(key)!.push(oh);
            }
            return [...byPerson.entries()].map(([key, slots]) => {
              const first = slots[0];
              return (
                <div key={key} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Person header */}
                  <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                      first.role === 'professor'
                        ? 'bg-gradient-to-br from-navy to-navy/70'
                        : 'bg-gradient-to-br from-brand-orange to-amber-warm'
                    }`}>
                      <span className="text-xl select-none">
                        {first.role === 'professor' ? '👨‍🏫' : '🧑‍💻'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm">{first.personName}</p>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[first.role]}`}>
                        {ROLE_LABELS[first.role]}
                      </span>
                    </div>
                  </div>

                  {/* Time slots */}
                  <div className="divide-y divide-gray-50">
                    {slots.map(oh => {
                      const av = assess(oh, courses, classMeetings, assignments, studyBlocks, today);
                      return (
                        <div key={oh.id} className="px-5 py-4 flex items-start gap-3 group">
                          <div className="flex-1 space-y-2.5">
                            {/* Time + location row */}
                            <div className="flex items-center gap-4 flex-wrap">
                              <div className="flex items-center gap-1.5">
                                <Clock size={13} className="text-gray-400 flex-shrink-0" />
                                <span className="text-sm font-medium text-gray-800">
                                  {DAYS_FULL[oh.dayOfWeek]}s &nbsp;{fmt12(oh.startTime)} &ndash; {fmt12(oh.endTime)}
                                </span>
                              </div>
                              {oh.location && (
                                <div className="flex items-center gap-1.5">
                                  <MapPin size={13} className="text-gray-400 flex-shrink-0" />
                                  <span className="text-sm text-gray-600">{oh.location}</span>
                                </div>
                              )}
                            </div>

                            {/* Availability badge */}
                            <AvailabilityBadge av={av} />
                          </div>
                          <button
                            onClick={() => onDeleteOfficeHours(oh.id)}
                            className="p-1.5 text-gray-300 hover:text-crimson hover:bg-crimson/5 rounded-lg transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}

          {/* Upcoming assignments for context */}
          {upcoming.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <span>📚</span> Upcoming Work for <span style={{ color: course?.color }}>{course?.code}</span>
              </h3>
              <div className="space-y-2">
                {upcoming.slice(0, 5).map(a => (
                  <div key={a.id} className="flex items-center gap-3">
                    {a.daysLeft <= 7
                      ? <AlertTriangle size={14} className="text-crimson flex-shrink-0" />
                      : <CheckCircle2 size={14} className="text-gray-300 flex-shrink-0" />
                    }
                    <span className="text-sm text-gray-700 flex-1 truncate">{a.title}</span>
                    <span className={`text-xs font-semibold flex-shrink-0 ${
                      a.daysLeft <= 3 ? 'text-crimson' : a.daysLeft <= 7 ? 'text-brand-orange' : 'text-gray-400'
                    }`}>
                      {a.daysLeft === 0 ? 'Today' : `${a.daysLeft}d`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Availability Badge ────────────────────────────────────────────────────────

function AvailabilityBadge({ av }: { av: Availability }) {
  const configs = {
    conflict: {
      bg: 'bg-crimson/8',
      border: 'border-crimson/20',
      icon: <XCircle size={13} className="text-crimson flex-shrink-0 mt-0.5" />,
      headlineColor: 'text-crimson',
      detailColor: 'text-crimson/70',
    },
    busy: {
      bg: 'bg-brand-orange/8',
      border: 'border-brand-orange/20',
      icon: <AlertTriangle size={13} className="text-brand-orange flex-shrink-0 mt-0.5" />,
      headlineColor: 'text-brand-orange',
      detailColor: 'text-brand-orange/70',
    },
    'has-work': {
      bg: 'bg-amber-warm/10',
      border: 'border-amber-warm/30',
      icon: <BookOpen size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />,
      headlineColor: 'text-amber-700',
      detailColor: 'text-amber-600/80',
    },
    free: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      icon: <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0 mt-0.5" />,
      headlineColor: 'text-emerald-700',
      detailColor: 'text-emerald-600/80',
    },
  };
  const cfg = configs[av.status];
  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border ${cfg.bg} ${cfg.border}`}>
      {cfg.icon}
      <div>
        <p className={`text-xs font-semibold ${cfg.headlineColor}`}>{av.headline}</p>
        <p className={`text-xs mt-0.5 ${cfg.detailColor}`}>{av.detail}</p>
      </div>
    </div>
  );
}

const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
      {children}
    </div>
  );
}
