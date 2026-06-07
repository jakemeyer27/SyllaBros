import { useState } from 'react';
import { Plus, Trash2, Edit2, X, Check, CheckCircle2, Circle, Sparkles, RefreshCw, AlertCircle, ChevronDown } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import type { Assignment, AssignmentType, Course, OfficeHours } from '../types';
import SyllabusImport from './SyllabusImport';
import CanvasSync from './CanvasSync';

interface Props {
  courses: Course[];
  assignments: Assignment[];
  today: Date;
  getToken: () => Promise<string | null>;
  completedIds: Set<string>;
  onToggleCompleted: (id: string) => void;
  onAdd: (a: Assignment) => void;
  onUpdate: (a: Assignment) => void;
  onDelete: (id: string) => void;
  onAddOfficeHours: (ohs: OfficeHours[]) => void;
}

type FormData = Omit<Assignment, 'id'>;

const emptyForm = (courseId = '', today = new Date()): FormData => ({
  courseId,
  title: '',
  dueDate: format(today, 'yyyy-MM-dd'),
  type: 'homework',
  weight: 10,
  score: null,
  maxScore: 100,
  tentative: false,
});

const TYPES: AssignmentType[] = ['exam', 'quiz', 'homework', 'project', 'participation', 'other'];

const TYPE_COLORS: Record<AssignmentType, string> = {
  exam:          'bg-crimson/10 text-crimson',
  quiz:          'bg-brand-orange/10 text-brand-orange',
  homework:      'bg-navy/10 text-navy',
  project:       'bg-emerald-100 text-emerald-700',
  participation: 'bg-gray-100 text-gray-500',
  other:         'bg-gray-100 text-gray-500',
};

export default function Assignments({ courses, assignments, today, getToken, completedIds, onToggleCompleted, onAdd, onUpdate, onDelete, onAddOfficeHours }: Props) {
  const [showForm, setShowForm]         = useState(false);
  const [showImport, setShowImport]     = useState(false);
  const [showCanvas, setShowCanvas]     = useState(false);
  const [editId, setEditId]             = useState<string | null>(null);
  const [activeCourse, setActiveCourse] = useState<string>(courses[0]?.id ?? '');
  const [form, setForm]                 = useState<FormData>(emptyForm(courses[0]?.id ?? ''));
  const [listOpen, setListOpen]         = useState(true);
  const [semOpen, setSemOpen]           = useState(true);
  const [doneOpen, setDoneOpen]         = useState(false); // collapsed by default

  const courseIds  = courses.map(c => c.id);
  const safeActive = courseIds.includes(activeCourse) ? activeCourse : (courses[0]?.id ?? '');
  const course     = courses.find(c => c.id === safeActive);

  const participationItems = assignments
    .filter(a => a.courseId === safeActive && a.type === 'participation');

  const courseAssignments = assignments
    .filter(a => a.courseId === safeActive && a.type !== 'participation')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const grouped: Record<string, Assignment[]> = {};
  for (const a of courseAssignments) {
    let label: string;
    if (completedIds.has(a.id)) {
      label = 'Done';
    } else if (a.score !== null) {
      label = 'Graded';
    } else if (differenceInDays(parseISO(a.dueDate), today) < 0) {
      label = 'Overdue';
    } else {
      label = 'Upcoming';
    }
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(a);
  }
  const order = ['Overdue', 'Upcoming', 'Graded', 'Done'];

  function submit() {
    if (!form.title.trim() || !form.courseId) return;
    if (editId) {
      onUpdate({ ...form, id: editId });
      setEditId(null);
    } else {
      onAdd({ ...form, id: crypto.randomUUID() });
    }
    setForm(emptyForm(form.courseId));
    setShowForm(false);
  }

  function startEdit(a: Assignment) {
    const { id, ...rest } = a;
    setForm(rest);
    setEditId(id);
    setShowForm(true);
  }

  function cancel() {
    setForm(emptyForm(safeActive));
    setEditId(null);
    setShowForm(false);
  }

  function openAdd() {
    cancel();
    setForm(emptyForm(safeActive));
    setShowForm(true);
  }

  return (
    <div className="space-y-4">
      {/* Modals */}
      {showImport && (
        <SyllabusImport
          courses={courses}
          today={today}
          getToken={getToken}
          onAdd={a => onAdd(a)}
          onAddOfficeHours={onAddOfficeHours}
          onClose={() => setShowImport(false)}
        />
      )}
      {showCanvas && (
        <CanvasSync
          courses={courses}
          assignments={assignments}
          getToken={getToken}
          onUpdate={onUpdate}
          onClose={() => setShowCanvas(false)}
        />
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <span className="text-xl">📋</span> Assignments & Exams
        </h2>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowCanvas(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <RefreshCw size={14} /> Canvas Sync
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-warm text-navy text-sm font-semibold rounded-lg hover:bg-amber-warm/80 transition-colors"
          >
            <Sparkles size={14} /> Import Syllabus
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-navy text-white text-sm rounded-lg hover:bg-navy/90 transition-colors"
          >
            <Plus size={15} /> Add
          </button>
        </div>
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
          <div className="text-6xl mb-4">📋</div>
          <p className="text-lg font-bold text-gray-700">No courses yet</p>
          <p className="text-sm text-gray-400 mt-1">Head to the Courses tab and add your courses first.</p>
        </div>
      ) : (
        <>
          {/* Course tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {courses.map(c => {
              const count = assignments.filter(a => a.courseId === c.id).length;
              const isActive = safeActive === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => { setActiveCourse(c.id); cancel(); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all border-2 ${
                    isActive
                      ? 'text-white border-transparent shadow-sm'
                      : 'bg-white text-gray-500 border-gray-100 hover:border-gray-200 hover:text-gray-700'
                  }`}
                  style={isActive ? { background: c.color, borderColor: c.color } : {}}
                >
                  <span>{c.code}</span>
                  {count > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Add / Edit form */}
          {showForm && (
            <div className="bg-white border border-navy/10 rounded-2xl p-5 shadow-sm">
              <h3 className="font-semibold text-gray-700 mb-4">{editId ? 'Edit Assignment' : 'New Assignment'}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Course" required>
                  <select value={form.courseId} onChange={e => setForm(f => ({ ...f, courseId: e.target.value }))} className={inp}>
                    <option value="">Select course</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                  </select>
                </Field>
                <Field label="Title" required>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Midterm Exam" className={inp} />
                </Field>
                {form.type !== 'participation' && (
                  <Field label="Due Date">
                    <input type="date" value={form.dueDate}
                      onChange={e => setForm(f => ({ ...f, dueDate: e.target.value, tentative: false }))}
                      className={inp} />
                    {form.tentative && (
                      <p className="text-[11px] text-brand-orange mt-1 flex items-center gap-1">
                        <AlertCircle size={10} /> Placeholder date — update when professor confirms.
                      </p>
                    )}
                  </Field>
                )}
                {form.type === 'participation' && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-500 col-span-1">
                    <Circle size={13} className="text-gray-300 flex-shrink-0" />
                    Participation is graded across the whole semester — no due date needed.
                  </div>
                )}
                <Field label="Type">
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as AssignmentType }))} className={inp}>
                    {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </Field>
                <Field label="Grade Weight (% of course)">
                  <input type="number" min={0} max={100} value={form.weight}
                    onChange={e => setForm(f => ({ ...f, weight: Number(e.target.value) }))} className={inp} />
                </Field>
                <Field label="Score Earned (leave blank if not graded yet)">
                  <input type="number" min={0} max={form.maxScore}
                    value={form.score ?? ''}
                    onChange={e => setForm(f => ({ ...f, score: e.target.value === '' ? null : Number(e.target.value) }))}
                    placeholder="e.g. 87" className={inp} />
                </Field>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={submit} className="flex items-center gap-1 px-4 py-2 bg-navy text-white text-sm rounded-lg hover:bg-navy/90">
                  <Check size={14} /> {editId ? 'Save' : 'Add'}
                </button>
                <button onClick={cancel} className="flex items-center gap-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
                  <X size={14} /> Cancel
                </button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {courseAssignments.length === 0 && participationItems.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm">
              <div className="text-5xl mb-3">✍️</div>
              <p className="font-bold text-gray-700">Nothing here yet for {course?.code}</p>
              <p className="text-sm text-gray-400 mt-1">Click <strong>Add</strong> or <strong>Import Syllabus</strong> to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">

              {/* ── Assignments accordion ── */}
              {courseAssignments.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Toggle header */}
                  <button
                    onClick={() => setListOpen(o => !o)}
                    className="w-full flex items-center justify-between px-5 py-4 transition-colors"
                    style={{ background: course?.color ? course.color + '12' : '#f9fafb' }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-base">📋</span>
                      <span className="font-bold" style={{ color: course?.color ?? '#374151' }}>Assignments</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white"
                        style={{ background: course?.color ?? '#6b7280' }}>
                        {courseAssignments.length}
                      </span>
                    </div>
                    <ChevronDown
                      size={18}
                      style={{ color: course?.color ?? '#9ca3af' }}
                      className={`transition-transform duration-200 ${listOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {/* Assignment list */}
                  {listOpen && (
                    <div className="border-t border-gray-100">
                      {order.filter(g => grouped[g]).map(group => {
                        const isDoneGroup = group === 'Done';
                        const isOpen = isDoneGroup ? doneOpen : true;
                        return (
                        <div key={group}>
                          {/* Group label — Done group is collapsible */}
                          <div
                            className={`px-4 py-2.5 border-b border-gray-50 bg-gray-50/50 ${isDoneGroup ? 'cursor-pointer hover:bg-gray-100/60 transition-colors' : ''}`}
                            onClick={isDoneGroup ? () => setDoneOpen(o => !o) : undefined}
                          >
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                              group === 'Overdue' ? 'bg-crimson text-white' :
                              group === 'Upcoming' ? 'bg-navy text-white' :
                              group === 'Done' ? 'bg-gray-200 text-gray-500' :
                              'bg-emerald-500 text-white'
                            }`}>
                              {group === 'Overdue' ? '🔥' : group === 'Upcoming' ? '📅' : group === 'Done' ? '✅' : '⭐'} {group} · {grouped[group].length}
                            </span>
                            {isDoneGroup && (
                              <span className="ml-2 text-[10px] text-gray-400">
                                {doneOpen ? '▲ hide' : '▼ show'}
                              </span>
                            )}
                          </div>
                          {/* Rows */}
                          {isOpen && grouped[group].map(a => {
                            const done = completedIds.has(a.id);
                            const days = differenceInDays(parseISO(a.dueDate), today);
                            const pct  = a.score !== null ? (a.score / a.maxScore) * 100 : null;
                            return (
                              <div key={a.id} className={`flex items-center gap-3 px-5 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors ${done ? 'opacity-50' : ''}`}>
                                {/* Clickable checkbox */}
                                <button
                                  onClick={() => onToggleCompleted(a.id)}
                                  title={done ? 'Mark as not done' : 'Mark as done'}
                                  className="flex-shrink-0 p-0.5 rounded-full transition-colors hover:scale-110 active:scale-95"
                                >
                                  {done || pct !== null
                                    ? <CheckCircle2 size={18} className={done ? 'text-emerald-400' : 'text-emerald-500'} />
                                    : <Circle size={18} className="text-gray-300 hover:text-emerald-400 transition-colors" />
                                  }
                                </button>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className={`text-sm font-medium ${done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                      {a.title}
                                    </p>
                                    {a.tentative && !done && (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-warm/20 text-brand-orange border border-amber-warm/40 whitespace-nowrap">
                                        <AlertCircle size={9} /> Tentative
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[a.type]}`}>
                                      {a.type.charAt(0).toUpperCase() + a.type.slice(1)}
                                    </span>
                                    <span className="text-xs text-gray-400">{a.weight}% of grade</span>
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0 min-w-[48px]">
                                  {pct !== null ? (
                                    <p className={`text-sm font-bold ${pct >= 90 ? 'text-emerald-600' : pct >= 75 ? 'text-brand-orange' : 'text-crimson'}`}>
                                      {pct.toFixed(1)}%
                                    </p>
                                  ) : done ? (
                                    <p className="text-xs font-semibold text-emerald-500">Submitted</p>
                                  ) : (
                                    <p className={`text-xs font-semibold ${days < 0 ? 'text-crimson' : days <= 3 ? 'text-brand-orange' : 'text-gray-400'}`}>
                                      {days < 0 ? `${Math.abs(days)}d ago` : days === 0 ? 'Today' : `${days}d`}
                                    </p>
                                  )}
                                  <p className="text-[11px] text-gray-400">{format(parseISO(a.dueDate), 'MMM d')}</p>
                                </div>
                                <div className="flex gap-1 flex-shrink-0">
                                  <button onClick={() => startEdit(a)} className="p-1.5 text-gray-300 hover:text-navy hover:bg-navy/5 rounded-lg transition-colors">
                                    <Edit2 size={13} />
                                  </button>
                                  <button onClick={() => onDelete(a.id)} className="p-1.5 text-gray-300 hover:text-crimson hover:bg-crimson/5 rounded-lg transition-colors">
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── Participation / Semester Grade accordion ── */}
              {participationItems.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <button
                    onClick={() => setSemOpen(o => !o)}
                    className="w-full flex items-center justify-between px-5 py-4 transition-colors bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-base">🎓</span>
                      <span className="font-bold text-gray-600">Semester Grade</span>
                      <span className="text-[11px] font-bold text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                        {participationItems.length}
                      </span>
                    </div>
                    <ChevronDown
                      size={18}
                      className={`text-gray-400 transition-transform duration-200 ${semOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {semOpen && (
                    <div className="border-t border-gray-100">
                      {participationItems.map(a => {
                        const pct = a.score !== null ? (a.score / a.maxScore) * 100 : null;
                        return (
                          <div key={a.id} className="flex items-center gap-3 px-5 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
                            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-[9px] font-bold text-gray-400 uppercase leading-tight text-center">All<br/>Sem</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-700">{a.title}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{a.weight}% of grade · end of semester</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              {pct !== null ? (
                                <p className={`text-sm font-bold ${pct >= 90 ? 'text-emerald-600' : pct >= 75 ? 'text-brand-orange' : 'text-crimson'}`}>
                                  {pct.toFixed(1)}%
                                </p>
                              ) : (
                                <p className="text-xs text-gray-400 italic">Not graded yet</p>
                              )}
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <button onClick={() => startEdit(a)} className="p-1.5 text-gray-300 hover:text-navy hover:bg-navy/5 rounded-lg transition-colors">
                                <Edit2 size={13} />
                              </button>
                              <button onClick={() => onDelete(a.id)} className="p-1.5 text-gray-300 hover:text-crimson hover:bg-crimson/5 rounded-lg transition-colors">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </>
      )}
    </div>
  );
}

const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30';

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}{required && ' *'}</label>
      {children}
    </div>
  );
}
