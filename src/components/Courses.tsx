import { useState } from 'react';
import { Plus, Trash2, Edit2, X, Check, CalendarDays } from 'lucide-react';
import type { Course, TermConfig } from '../types';
import { getEffectiveGrade } from '../scheduler';
import type { Assignment } from '../types';
import StudyBudgetPanel from './StudyBudgetPanel';
import CourseCalendar from './CourseCalendar';

const COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16'];

interface Props {
  courses: Course[];
  assignments: Assignment[];
  termConfig: TermConfig;
  onAdd: (c: Course) => void;
  onUpdate: (c: Course) => void;
  onDelete: (id: string) => void;
}

const empty = (): Omit<Course, 'id'> => ({
  name: '', code: '', creditHours: 3, color: COLORS[0], targetGrade: 90, avgHomeworkHours: null, overallGrade: null,
});

export default function Courses({ courses, assignments, termConfig, onAdd, onUpdate, onDelete }: Props) {
  const [showForm, setShowForm]       = useState(false);
  const [editId, setEditId]           = useState<string | null>(null);
  const [form, setForm]               = useState(empty());
  const [calendarCourse, setCalendarCourse] = useState<Course | null>(null);
  const today = new Date();

  function submit() {
    if (!form.name.trim()) return;
    if (editId) {
      onUpdate({ ...form, id: editId });
      setEditId(null);
    } else {
      onAdd({ ...form, id: crypto.randomUUID() });
    }
    setForm(empty());
    setShowForm(false);
  }

  function startEdit(c: Course) {
    const { id, ...rest } = c;
    setForm(rest);
    setEditId(id);
    setShowForm(true);
  }

  function cancel() {
    setForm(empty());
    setEditId(null);
    setShowForm(false);
  }

  return (
    <div className="space-y-4">
      {/* Course calendar modal */}
      {calendarCourse && (
        <CourseCalendar
          course={calendarCourse}
          assignments={assignments}
          today={today}
          onClose={() => setCalendarCourse(null)}
        />
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">My Courses</h2>
        <button
          onClick={() => { cancel(); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-navy text-white text-sm rounded-lg hover:bg-navy/90 transition-colors"
        >
          <Plus size={15} /> Add Course
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-navy/10 rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-4">{editId ? 'Edit Course' : 'New Course'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Course Name" required>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Financial Accounting" className={input} />
            </Field>
            <Field label="Course Code">
              <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                placeholder="e.g. ACCT 2301" className={input} />
            </Field>
            <Field label="Credit Hours">
              <input type="number" min={1} max={6} value={form.creditHours}
                onChange={e => setForm(f => ({ ...f, creditHours: Number(e.target.value) }))} className={input} />
            </Field>
            <Field label="Target Grade (%)">
              <input type="number" min={60} max={100} value={form.targetGrade}
                onChange={e => setForm(f => ({ ...f, targetGrade: Number(e.target.value) }))} className={input} />
            </Field>
            <Field label="Avg homework time (hrs)" hint="How long does one typical homework take you?">
              <input
                type="number" min={0.25} max={20} step={0.25}
                value={form.avgHomeworkHours ?? ''}
                onChange={e => setForm(f => ({
                  ...f,
                  avgHomeworkHours: e.target.value === '' ? null : Number(e.target.value),
                }))}
                placeholder="e.g. 1.5"
                className={input}
              />
            </Field>
            <Field label="Color">
              <div className="flex gap-2 flex-wrap pt-1">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                    style={{ background: c }} />
                ))}
              </div>
            </Field>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={submit} className="flex items-center gap-1 px-4 py-2 bg-navy text-white text-sm rounded-lg hover:bg-navy/90">
              <Check size={14} /> {editId ? 'Save' : 'Add Course'}
            </button>
            <button onClick={cancel} className="flex items-center gap-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      )}

      {courses.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
          <div className="text-6xl mb-4">📚</div>
          <p className="text-lg font-bold text-gray-700">No courses yet</p>
          <p className="text-sm text-gray-400 mt-1 mb-5">Add your courses to unlock your study plan, grades, and schedule.</p>
          <button
            onClick={() => { cancel(); setShowForm(true); }}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-navy text-white text-sm font-bold rounded-xl hover:bg-navy/90 transition-colors"
          >
            <Plus size={15} /> Add your first course
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map(c => {
            const grade = getEffectiveGrade(c, assignments);
            const pending = assignments.filter(a => a.courseId === c.id && a.score === null && a.type !== 'participation').length;
            const gradeGap = grade !== null ? c.targetGrade - grade : null;
            const gradeColor = grade === null ? '#9ca3af'
              : gradeGap !== null && gradeGap > 8 ? '#ef4444'
              : gradeGap !== null && gradeGap > 3 ? '#f97316'
              : '#22c55e';
            return (
              <div key={c.id} className="card-lift rounded-3xl overflow-hidden shadow-sm border border-white/60 bg-white">
                {/* ── Colored header banner ── */}
                <div
                  className="relative px-5 pt-5 pb-10"
                  style={{ background: `linear-gradient(135deg, ${c.color}, ${c.color}cc)` }}
                >
                  {/* Decorative circles */}
                  <div className="absolute top-0 right-0 w-28 h-28 rounded-full opacity-20 -translate-y-8 translate-x-8"
                    style={{ background: '#fff' }} />
                  <div className="absolute bottom-0 left-8 w-16 h-16 rounded-full opacity-10 translate-y-6"
                    style={{ background: '#fff' }} />

                  <div className="relative flex items-start justify-between">
                    <div>
                      <span className="inline-block text-[10px] font-black uppercase tracking-widest text-white/60 mb-1">
                        {c.code} · {c.creditHours} cr
                      </span>
                      <p className="text-lg font-black text-white leading-tight max-w-44">{c.name}</p>
                    </div>
                    <div className="flex gap-0.5 -mt-0.5">
                      <button onClick={() => setCalendarCourse(c)}
                        className="p-1.5 text-white/60 hover:text-white hover:bg-white/15 rounded-lg transition-colors" title="Course calendar">
                        <CalendarDays size={14} />
                      </button>
                      <button onClick={() => startEdit(c)}
                        className="p-1.5 text-white/60 hover:text-white hover:bg-white/15 rounded-lg transition-colors">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => onDelete(c.id)}
                        className="p-1.5 text-white/60 hover:text-white hover:bg-white/20 rounded-lg transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── Grade pill that overlaps the banner ── */}
                <div className="relative px-5 -mt-6 mb-4">
                  <div className="bg-white rounded-2xl shadow-md px-4 py-3 flex items-center justify-between border border-gray-50">
                    <div>
                      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Current Grade</p>
                      <p className="text-2xl font-black leading-none mt-0.5" style={{ color: gradeColor }}>
                        {grade !== null ? `${grade.toFixed(1)}%` : '—'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Target</p>
                      <p className="text-lg font-bold text-gray-400">{c.targetGrade}%</p>
                    </div>
                  </div>
                </div>

                {/* ── Progress bar ── */}
                <div className="px-5 pb-1">
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-2.5 rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(grade ?? 0, 100)}%`, background: c.color }}
                    />
                  </div>
                  {gradeGap !== null && (
                    <p className="text-xs mt-1.5 font-medium" style={{ color: gradeColor }}>
                      {gradeGap > 0
                        ? `${gradeGap.toFixed(1)} pts below target`
                        : `${Math.abs(gradeGap).toFixed(1)} pts above target 🎉`}
                    </p>
                  )}
                </div>

                {/* ── Stats row ── */}
                <div className="px-5 py-3 flex items-center gap-3 mt-1">
                  {pending > 0 && (
                    <span className="text-xs font-bold bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">
                      {pending} pending
                    </span>
                  )}
                  {pending === 0 && grade !== null && (
                    <span className="text-xs font-bold bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full">
                      ✓ All caught up
                    </span>
                  )}
                </div>

                {/* ── Study Budget Panel ── */}
                <div className="px-5 pb-5">
                  <StudyBudgetPanel
                    course={c}
                    assignments={assignments}
                    termConfig={termConfig}
                    onUpdateAvgHw={(hours) => onUpdate({ ...c, avgHomeworkHours: hours })}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const input = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30';

function Field({ label, children, required, hint }: {
  label: string; children: React.ReactNode; required?: boolean; hint?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">
        {label}{required && ' *'}
        {hint && <span className="text-gray-400 font-normal ml-1">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

