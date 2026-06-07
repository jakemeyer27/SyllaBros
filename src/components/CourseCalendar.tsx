import { useState, useEffect } from 'react';
import {
  X, ChevronLeft, ChevronRight, Check, Trash2, StickyNote,
} from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay, parseISO,
} from 'date-fns';
import type { Course, Assignment } from '../types';

interface Props {
  course: Course;
  assignments: Assignment[];
  today: Date;
  onClose: () => void;
}

type NoteMap = Record<string, string>; // { "YYYY-MM-DD": "note text" }

const NOTES_KEY = (courseId: string) => `syllabros_notes_${courseId}`;

function loadNotes(courseId: string): NoteMap {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY(courseId)) ?? '{}'); }
  catch { return {}; }
}

function saveNotes(courseId: string, notes: NoteMap) {
  localStorage.setItem(NOTES_KEY(courseId), JSON.stringify(notes));
}

const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function CourseCalendar({ course, assignments, today, onClose }: Props) {
  const [viewMonth, setViewMonth]   = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected]     = useState<string>(format(today, 'yyyy-MM-dd'));
  const [notes, setNotes]           = useState<NoteMap>(() => loadNotes(course.id));
  const [draftNote, setDraftNote]   = useState<string>('');
  const [saved, setSaved]           = useState(false);

  // Sync draft when selected day changes
  useEffect(() => {
    setDraftNote(notes[selected] ?? '');
    setSaved(false);
  }, [selected, notes]);

  // Build calendar grid
  const monthStart = startOfMonth(viewMonth);
  const monthEnd   = endOfMonth(viewMonth);
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd    = endOfWeek(monthEnd,   { weekStartsOn: 0 });

  const days: Date[] = [];
  let cur = gridStart;
  while (cur <= gridEnd) { days.push(cur); cur = addDays(cur, 1); }

  // Assignments due this month
  const dueOnDay = (dateStr: string) =>
    assignments.filter(a => a.courseId === course.id && a.dueDate === dateStr);

  function saveNote() {
    const updated = { ...notes };
    if (draftNote.trim()) {
      updated[selected] = draftNote.trim();
    } else {
      delete updated[selected];
    }
    setNotes(updated);
    saveNotes(course.id, updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  function deleteNote() {
    const updated = { ...notes };
    delete updated[selected];
    setNotes(updated);
    saveNotes(course.id, updated);
    setDraftNote('');
  }

  const selectedDue = dueOnDay(selected);
  const noteCount   = Object.keys(notes).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden max-h-[92vh]">

        {/* Header */}
        <div
          className="px-6 py-4 flex items-center justify-between flex-shrink-0"
          style={{ background: course.color }}
        >
          <div className="text-white">
            <p className="text-white/70 text-xs font-medium">{course.code}</p>
            <h2 className="font-bold text-base leading-tight">{course.name}</h2>
            <p className="text-white/60 text-xs mt-0.5">
              {noteCount} note{noteCount !== 1 ? 's' : ''} saved
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* Month navigation */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <button
              onClick={() => setViewMonth(m => subMonths(m, 1))}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="font-bold text-gray-800 text-sm">
              {format(viewMonth, 'MMMM yyyy')}
            </span>
            <button
              onClick={() => setViewMonth(m => addMonths(m, 1))}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 px-4 mb-1">
            {DAY_HEADERS.map(d => (
              <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wider text-gray-400 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 px-4 gap-y-1">
            {days.map(day => {
              const dateStr  = format(day, 'yyyy-MM-dd');
              const isToday  = isSameDay(day, today);
              const isSel    = dateStr === selected;
              const inMonth  = isSameMonth(day, viewMonth);
              const hasNote  = !!notes[dateStr];
              const due      = dueOnDay(dateStr);
              const hasDue   = due.length > 0;

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelected(dateStr)}
                  className={`relative flex flex-col items-center justify-center rounded-xl py-1.5 transition-all ${
                    isSel
                      ? 'text-white shadow-sm'
                      : isToday
                        ? 'bg-gray-100 text-gray-800 font-bold'
                        : inMonth
                          ? 'hover:bg-gray-50 text-gray-700'
                          : 'text-gray-300'
                  }`}
                  style={isSel ? { background: course.color } : {}}
                >
                  <span className="text-xs font-semibold leading-none">{format(day, 'd')}</span>
                  {/* Indicator dots */}
                  <div className="flex gap-0.5 mt-0.5 h-1">
                    {hasNote && (
                      <div className={`w-1 h-1 rounded-full ${isSel ? 'bg-white/70' : 'bg-amber-warm'}`} />
                    )}
                    {hasDue && (
                      <div className={`w-1 h-1 rounded-full ${isSel ? 'bg-white/70' : 'bg-crimson'}`} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 px-5 py-2 mt-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-warm" />
              <span className="text-[10px] text-gray-400">Note</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-crimson" />
              <span className="text-[10px] text-gray-400">Assignment due</span>
            </div>
          </div>

          <div className="border-t border-gray-100 mx-4" />

          {/* Selected day panel */}
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-800 text-sm">
                {format(parseISO(selected), 'EEEE, MMMM d')}
              </p>
              {notes[selected] && (
                <button
                  onClick={deleteNote}
                  className="p-1 text-gray-300 hover:text-crimson transition-colors rounded"
                  title="Delete note"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>

            {/* Assignments due on this day */}
            {selectedDue.length > 0 && (
              <div className="space-y-1">
                {selectedDue.map(a => (
                  <div key={a.id} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg bg-crimson/5">
                    <div className="w-1.5 h-1.5 rounded-full bg-crimson flex-shrink-0" />
                    <span className="text-crimson font-medium truncate">{a.title}</span>
                    <span className="text-crimson/60 ml-auto flex-shrink-0">{a.weight}%</span>
                  </div>
                ))}
              </div>
            )}

            {/* Note input */}
            <div>
              <label className="text-xs font-semibold text-gray-500 flex items-center gap-1.5 mb-1.5">
                <StickyNote size={11} /> Note / reminder
              </label>
              <textarea
                value={draftNote}
                onChange={e => { setDraftNote(e.target.value); setSaved(false); }}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveNote(); }}
                placeholder="Add a note for this day… (Ctrl+Enter to save)"
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 transition-all"
                style={{ '--tw-ring-color': course.color + '50' } as React.CSSProperties}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-gray-400">
                  {draftNote.length > 0 ? `${draftNote.length} chars` : 'Empty = delete note'}
                </span>
                <button
                  onClick={saveNote}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-semibold rounded-lg transition-colors"
                  style={{ background: course.color }}
                >
                  {saved
                    ? <><Check size={12} /> Saved!</>
                    : <><Check size={12} /> Save note</>
                  }
                </button>
              </div>
            </div>

            {/* Upcoming notes this month */}
            {Object.keys(notes).filter(d => d.startsWith(format(viewMonth, 'yyyy-MM'))).length > 0 && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Notes this month</p>
                <div className="space-y-1.5">
                  {Object.entries(notes)
                    .filter(([d]) => d.startsWith(format(viewMonth, 'yyyy-MM')))
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([d, text]) => (
                      <button
                        key={d}
                        onClick={() => setSelected(d)}
                        className={`w-full text-left flex items-start gap-2 px-3 py-2 rounded-xl transition-colors ${
                          d === selected ? 'bg-gray-100' : 'hover:bg-gray-50'
                        }`}
                      >
                        <span className="text-[11px] font-bold text-gray-400 flex-shrink-0 mt-0.5 w-8">
                          {format(parseISO(d), 'MMM d').split(' ')[1]}
                        </span>
                        <span className="text-xs text-gray-600 truncate">{text}</span>
                      </button>
                    ))
                  }
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
