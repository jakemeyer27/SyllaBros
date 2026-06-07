import { useState, useRef, useCallback } from 'react';
import { format, parseISO, startOfWeek, addDays, addWeeks } from 'date-fns';
import {
  X, Upload, Sparkles, Check, AlertTriangle, Loader2,
  FileText, ChevronRight, LayoutList, CalendarDays, ExternalLink,
} from 'lucide-react';
import type { Course, Assignment, AssignmentType, OfficeHours } from '../types';
import { apiUrl } from '../apiUrl';

interface ParsedItem {
  id: string; // temp client-side id
  included: boolean;
  title: string;
  dueDate: string | null;
  type: AssignmentType;
  weight: number | null;
  maxScore: number;
}

interface Props {
  courses: Course[];
  today: Date;
  onAdd: (a: Assignment) => void;
  onAddOfficeHours: (oh: OfficeHours[]) => void;
  onClose: () => void;
  getToken: () => Promise<string | null>;
}

type Step = 'upload' | 'parsing' | 'preview' | 'done';
type ViewMode = 'list' | 'week';

const TYPE_LABELS: Record<AssignmentType, string> = {
  exam: 'Exam', quiz: 'Quiz', homework: 'Homework',
  project: 'Project', participation: 'Participation', other: 'Other',
};

const TYPE_COLORS: Record<AssignmentType, string> = {
  exam: 'bg-crimson/10 text-crimson border-crimson/20',
  quiz: 'bg-brand-orange/10 text-brand-orange border-brand-orange/20',
  homework: 'bg-navy/10 text-navy border-navy/20',
  project: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  participation: 'bg-gray-100 text-gray-600 border-gray-200',
  other: 'bg-gray-100 text-gray-600 border-gray-200',
};

const ASSIGNMENT_TYPES: AssignmentType[] = ['exam', 'quiz', 'homework', 'project', 'participation', 'other'];

export default function SyllabusImport({ courses, today, onAdd, onAddOfficeHours, onClose, getToken }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '');
  const [pastedText, setPastedText] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileData, setFileData] = useState<File | null>(null);
  const [semesterStart, setSemesterStart] = useState(format(today, 'yyyy-MM-dd'));
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [error, setError] = useState('');
  const [parseInfo, setParseInfo] = useState('');
  const [addedCount, setAddedCount] = useState(0);
  const dropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const course = courses.find(c => c.id === courseId);

  // ── File drag & drop ────────────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) { setFileData(file); setFileName(file.name); }
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setFileData(file); setFileName(file.name); }
  };

  // ── Parse syllabus ──────────────────────────────────────────────────────────
  async function parse() {
    if (!courseId) { setError('Please select a course first.'); return; }
    if (!fileData && !pastedText.trim()) { setError('Upload a file or paste your syllabus text.'); return; }

    setError('');
    setStep('parsing');

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const weeksInTerm = 16; // could come from termConfig via props if needed

      const formData = new FormData();
      if (fileData) formData.append('file', fileData);
      if (pastedText.trim()) formData.append('text', pastedText);
      formData.append('course_id', courseId);
      formData.append('course_name', course?.name ?? '');
      formData.append('course_code', course?.code ?? '');
      formData.append('semester_start', semesterStart);
      formData.append('weeks_in_term', String(weeksInTerm));

      const res = await fetch(apiUrl('/api/parse-syllabus'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.hint) {
          setError(`${data.error}\n\n${data.hint}`);
        } else {
          setError(data.error ?? 'Parsing failed');
        }
        setStep('upload');
        return;
      }

      const parsed: ParsedItem[] = (data.assignments as Array<{
        title: string; dueDate: string | null; type: string;
        weight: number | null; maxScore: number;
      }>).map((a, i) => ({
        id: `parsed-${i}`,
        included: true,
        title: a.title,
        dueDate: a.dueDate,
        type: (ASSIGNMENT_TYPES.includes(a.type as AssignmentType) ? a.type : 'other') as AssignmentType,
        weight: a.weight,
        maxScore: a.maxScore ?? 100,
      }));

      // Save office hours immediately (attached to the selected course)
      if (Array.isArray(data.officeHours) && data.officeHours.length > 0) {
        const ohs: OfficeHours[] = (data.officeHours as Array<{
          personName: string; role: string; dayOfWeek: number;
          startTime: string; endTime: string; location: string;
        }>).map(o => ({
          id: crypto.randomUUID(),
          courseId,
          personName: o.personName,
          role: (['professor','ta','other'].includes(o.role) ? o.role : 'other') as OfficeHours['role'],
          dayOfWeek: o.dayOfWeek,
          startTime: o.startTime,
          endTime: o.endTime,
          location: o.location,
        }));
        onAddOfficeHours(ohs);
      }

      setItems(parsed);
      setParseInfo(
        `${parsed.length} assignments` +
        (data.officeHours?.length ? ` + ${data.officeHours.length} office hour slot${data.officeHours.length !== 1 ? 's' : ''} found` : ' found') +
        ` · ${(data.charsParsed / 1000).toFixed(1)}k chars read`
      );
      setStep('preview');
    } catch (e) {
      setError(String(e));
      setStep('upload');
    }
  }

  // ── Item editing ────────────────────────────────────────────────────────────
  function updateItem(id: string, patch: Partial<ParsedItem>) {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
  }

  function toggleAll(val: boolean) {
    setItems(prev => prev.map(item => ({ ...item, included: val })));
  }

  // ── Add to calendar ─────────────────────────────────────────────────────────
  async function addAll() {
    const toAdd = items.filter(i => i.included && i.title.trim());

    // Assignments without dates get spread evenly through the semester (1 per week)
    // so they don't all pile up on the same day
    const noDates = toAdd.filter(i => !i.dueDate);
    const semStart = parseISO(semesterStart);
    let noDateWeek = 1; // start at week 1, increment per undated assignment

    for (const item of toAdd) {
      const wasMissingDate = !item.dueDate;
      let dueDate = item.dueDate;
      if (!dueDate) {
        // Space undated items one per week from semester start
        dueDate = format(addWeeks(semStart, noDateWeek), 'yyyy-MM-dd');
        noDateWeek += Math.max(1, Math.floor(16 / Math.max(noDates.length, 1)));
      }

      const assignment: Assignment = {
        id: crypto.randomUUID(),
        courseId,
        title: item.title.trim(),
        dueDate,
        type: item.type,
        weight: item.weight ?? 0,
        maxScore: item.maxScore,
        score: null,
        tentative: wasMissingDate, // no published date → mark as subject to change
      };
      onAdd(assignment);
    }
    setAddedCount(toAdd.length);
    setStep('done');
  }

  // ── Week grouping for preview ───────────────────────────────────────────────
  function groupByWeek(list: ParsedItem[]): Map<string, ParsedItem[]> {
    const map = new Map<string, ParsedItem[]>();
    for (const item of list) {
      const key = item.dueDate
        ? format(startOfWeek(parseISO(item.dueDate), { weekStartsOn: 1 }), 'yyyy-MM-dd')
        : 'no-date';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    // Sort weeks
    return new Map([...map.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  }

  const included = items.filter(i => i.included).length;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-navy to-navy/80 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 text-white">
            <div className="w-9 h-9 bg-crimson rounded-xl flex items-center justify-center">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight">AI Syllabus Import</h2>
              <p className="text-white/60 text-xs">Upload your syllabus — AI extracts every assignment automatically</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Steps indicator */}
        {step !== 'done' && (
          <div className="flex border-b border-gray-100 bg-gray-50 px-6 py-2.5 gap-6 flex-shrink-0">
            {(['upload', 'parsing', 'preview'] as Step[]).map((s, i) => (
              <div key={s} className={`flex items-center gap-1.5 text-xs font-medium ${
                step === s ? 'text-navy' : (
                  ['upload', 'parsing', 'preview'].indexOf(step) > i ? 'text-emerald-600' : 'text-gray-400'
                )
              }`}>
                {['upload', 'parsing', 'preview'].indexOf(step) > i
                  ? <Check size={12} className="text-emerald-500" />
                  : <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold border ${step === s ? 'bg-navy text-white border-navy' : 'border-gray-300 text-gray-400'}`}>{i + 1}</span>
                }
                {s === 'upload' ? 'Upload' : s === 'parsing' ? 'Parsing' : 'Review & Confirm'}
                {i < 2 && <ChevronRight size={11} className="text-gray-300 ml-1" />}
              </div>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── STEP: Upload ────────────────────────────────────────────── */}
          {step === 'upload' && (
            <div className="p-6 space-y-5">
              {/* Course select */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Which course is this syllabus for?</label>
                {courses.length === 0 ? (
                  <p className="text-sm text-crimson">Add a course first before importing a syllabus.</p>
                ) : (
                  <select
                    value={courseId}
                    onChange={e => setCourseId(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-navy/30"
                  >
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Semester start */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">
                  Semester start date <span className="text-gray-400 font-normal">(helps convert "Week 3" to real dates)</span>
                </label>
                <input
                  type="date"
                  value={semesterStart}
                  onChange={e => setSemesterStart(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                />
              </div>

              {/* File drop zone */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Upload file <span className="font-normal text-gray-400">(PDF, Word, or TXT)</span></label>
                <div
                  ref={dropRef}
                  onDrop={onDrop}
                  onDragOver={e => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                    fileData ? 'border-navy/40 bg-navy/5' : 'border-gray-200 hover:border-navy/30 hover:bg-gray-50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={onFileChange}
                    className="hidden"
                  />
                  {fileData ? (
                    <div className="flex items-center justify-center gap-2.5">
                      <FileText size={20} className="text-navy" />
                      <span className="text-sm font-medium text-navy">{fileName}</span>
                      <button
                        onClick={e => { e.stopPropagation(); setFileData(null); setFileName(''); }}
                        className="text-gray-400 hover:text-crimson ml-1"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload size={24} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-sm text-gray-500">Drag and drop your syllabus here</p>
                      <p className="text-xs text-gray-400 mt-1">or click to browse · PDF, Word, TXT</p>
                    </>
                  )}
                </div>
              </div>

              {/* OR paste */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">
                  — or paste syllabus text directly —
                </label>
                <textarea
                  value={pastedText}
                  onChange={e => setPastedText(e.target.value)}
                  placeholder="Paste your entire syllabus here (course schedule, grading breakdown, assignment list...)"
                  rows={6}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-navy/30"
                />
              </div>

              {/* API key warning */}
              {error.includes('ANTHROPIC_API_KEY') ? (
                <div className="bg-amber-warm/10 border border-amber-warm/30 rounded-xl p-4 text-sm">
                  <p className="font-semibold text-brand-orange flex items-center gap-2 mb-1">
                    <AlertTriangle size={15} /> Anthropic API Key Required
                  </p>
                  <p className="text-gray-600 text-xs leading-relaxed">
                    Add <code className="bg-gray-100 px-1 rounded">ANTHROPIC_API_KEY=sk-ant-...</code> to your <code className="bg-gray-100 px-1 rounded">.env.local</code> file, then restart the server.
                  </p>
                  <a
                    href="https://console.anthropic.com/settings/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-xs text-navy font-medium hover:underline"
                  >
                    Get a key at console.anthropic.com <ExternalLink size={11} />
                  </a>
                </div>
              ) : error ? (
                <div className="bg-crimson/5 border border-crimson/20 rounded-xl p-3 text-sm text-crimson flex items-start gap-2">
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                  <span className="whitespace-pre-line">{error}</span>
                </div>
              ) : null}
            </div>
          )}

          {/* ── STEP: Parsing ────────────────────────────────────────────── */}
          {step === 'parsing' && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-14 h-14 bg-navy/10 rounded-2xl flex items-center justify-center">
                <Loader2 size={26} className="animate-spin text-navy" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-gray-800">Reading your syllabus…</p>
                <p className="text-sm text-gray-400 mt-1">Claude is extracting assignments, dates, and weights</p>
              </div>
            </div>
          )}

          {/* ── STEP: Preview ────────────────────────────────────────────── */}
          {step === 'preview' && (
            <div className="p-6 space-y-4">
              {/* No-date warning */}
              {items.filter(i => i.included && !i.dueDate).length > 0 && (
                <div className="flex items-start gap-2.5 bg-amber-warm/10 border border-amber-warm/30 rounded-xl px-4 py-3">
                  <AlertTriangle size={14} className="text-brand-orange flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-700">
                    <strong className="text-brand-orange">{items.filter(i => i.included && !i.dueDate).length} items have no date</strong> in your syllabus —
                    they'll be spread evenly through your semester as placeholders. You can edit dates after adding.
                  </p>
                </div>
              )}
              {/* Summary bar */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {items.length} assignments extracted
                  </p>
                  <p className="text-xs text-gray-400">{parseInfo}</p>
                </div>
                <div className="flex items-center gap-2">
                  {/* View toggle */}
                  <div className="flex p-0.5 bg-gray-100 rounded-lg gap-0.5">
                    <button
                      onClick={() => setViewMode('list')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === 'list' ? 'bg-white text-navy shadow-sm' : 'text-gray-500'}`}
                    >
                      <LayoutList size={12} /> List
                    </button>
                    <button
                      onClick={() => setViewMode('week')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === 'week' ? 'bg-white text-navy shadow-sm' : 'text-gray-500'}`}
                    >
                      <CalendarDays size={12} /> By Week
                    </button>
                  </div>
                  {/* Select all */}
                  <div className="flex gap-1">
                    <button onClick={() => toggleAll(true)} className="text-xs text-navy font-medium hover:underline">All</button>
                    <span className="text-gray-300">·</span>
                    <button onClick={() => toggleAll(false)} className="text-xs text-gray-400 hover:underline">None</button>
                  </div>
                </div>
              </div>

              {/* Items */}
              {viewMode === 'list' ? (
                <AssignmentList items={items} courseColor={course?.color} onUpdate={updateItem} />
              ) : (
                <WeekView items={items} courseColor={course?.color} onUpdate={updateItem} />
              )}
            </div>
          )}

          {/* ── STEP: Done ──────────────────────────────────────────────── */}
          {step === 'done' && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center">
                <Check size={28} className="text-emerald-600" />
              </div>
              <div className="text-center">
                <p className="font-bold text-gray-800 text-lg">
                  {addedCount} assignment{addedCount !== 1 ? 's' : ''} added!
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Check the Syllabus tab to review and edit them.
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-navy text-white font-medium rounded-xl hover:bg-navy/90 transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {(step === 'upload' || step === 'preview') && (
          <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-between bg-white flex-shrink-0">
            {step === 'upload' ? (
              <>
                <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                <button
                  onClick={parse}
                  disabled={courses.length === 0 || (!fileData && !pastedText.trim())}
                  className="flex items-center gap-2 px-5 py-2.5 bg-navy text-white font-semibold rounded-xl hover:bg-navy/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Sparkles size={15} /> Parse with AI
                </button>
              </>
            ) : (
              <>
                <button onClick={() => { setStep('upload'); setItems([]); }} className="text-sm text-gray-500 hover:text-gray-700">
                  ← Re-upload
                </button>
                <button
                  onClick={addAll}
                  disabled={included === 0}
                  className="flex items-center gap-2 px-5 py-2.5 bg-navy text-white font-semibold rounded-xl hover:bg-navy/90 transition-colors disabled:opacity-40"
                >
                  <Check size={15} /> Add {included} to Calendar
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Assignment list view ─────────────────────────────────────────────────────

function AssignmentList({ items, courseColor, onUpdate }: {
  items: ParsedItem[];
  courseColor?: string;
  onUpdate: (id: string, patch: Partial<ParsedItem>) => void;
}) {
  return (
    <div className="space-y-1.5">
      {/* Header */}
      <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-2 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
        <span className="w-5" />
        <span>Title</span>
        <span className="w-24 text-center">Due Date</span>
        <span className="w-24 text-center">Type</span>
        <span className="w-12 text-right">Weight</span>
      </div>
      {items.map(item => (
        <ItemRow key={item.id} item={item} courseColor={courseColor} onUpdate={onUpdate} />
      ))}
    </div>
  );
}

// ─── Week view ────────────────────────────────────────────────────────────────

function WeekView({ items, courseColor, onUpdate }: {
  items: ParsedItem[];
  courseColor?: string;
  onUpdate: (id: string, patch: Partial<ParsedItem>) => void;
}) {
  const weeks = new Map<string, ParsedItem[]>();
  for (const item of items) {
    const key = item.dueDate
      ? format(startOfWeek(parseISO(item.dueDate), { weekStartsOn: 1 }), 'yyyy-MM-dd')
      : 'no-date';
    if (!weeks.has(key)) weeks.set(key, []);
    weeks.get(key)!.push(item);
  }
  const sorted = [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-4">
      {sorted.map(([weekKey, weekItems]) => (
        <div key={weekKey}>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
              {weekKey === 'no-date'
                ? 'No Date Set'
                : `Week of ${format(parseISO(weekKey), 'MMM d')} — ${format(addDays(parseISO(weekKey), 4), 'MMM d')}`
              }
            </span>
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400">{weekItems.filter(i => i.included).length}/{weekItems.length}</span>
          </div>
          <div className="space-y-1.5">
            {weekItems.map(item => (
              <ItemRow key={item.id} item={item} courseColor={courseColor} onUpdate={onUpdate} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Single editable row ──────────────────────────────────────────────────────

function ItemRow({ item, courseColor, onUpdate }: {
  item: ParsedItem;
  courseColor?: string;
  onUpdate: (id: string, patch: Partial<ParsedItem>) => void;
}) {
  return (
    <div className={`grid grid-cols-[auto_1fr_auto_auto_auto] gap-2 items-center px-2 py-2 rounded-xl transition-colors ${
      item.included ? 'bg-gray-50 hover:bg-gray-100' : 'opacity-40 bg-white'
    }`}>
      {/* Checkbox */}
      <button
        onClick={() => onUpdate(item.id, { included: !item.included })}
        className="w-5 h-5 flex-shrink-0"
      >
        {item.included
          ? <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: courseColor ?? '#083152' }}>
              <Check size={11} className="text-white" />
            </div>
          : <div className="w-5 h-5 rounded-md border-2 border-gray-300" />
        }
      </button>

      {/* Title */}
      <input
        value={item.title}
        onChange={e => onUpdate(item.id, { title: e.target.value })}
        className="text-sm bg-transparent border-b border-transparent hover:border-gray-200 focus:border-navy/40 focus:outline-none px-1 py-0.5 truncate"
      />

      {/* Date */}
      <input
        type="date"
        value={item.dueDate ?? ''}
        onChange={e => onUpdate(item.id, { dueDate: e.target.value || null })}
        className="w-32 text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-navy/30"
      />

      {/* Type */}
      <select
        value={item.type}
        onChange={e => onUpdate(item.id, { type: e.target.value as AssignmentType })}
        className={`text-[11px] font-semibold px-1.5 py-1 rounded-lg border focus:outline-none ${TYPE_COLORS[item.type]}`}
      >
        {(['exam','quiz','homework','project','participation','other'] as AssignmentType[]).map(t => (
          <option key={t} value={t}>{TYPE_LABELS[t]}</option>
        ))}
      </select>

      {/* Weight */}
      <div className="w-14 flex items-center gap-0.5">
        <input
          type="number" min={0} max={100} step={0.5}
          value={item.weight ?? ''}
          onChange={e => onUpdate(item.id, { weight: e.target.value === '' ? null : Number(e.target.value) })}
          placeholder="—"
          className="w-10 text-xs text-right border border-gray-200 rounded-lg px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-navy/30"
        />
        <span className="text-xs text-gray-400">%</span>
      </div>
    </div>
  );
}
