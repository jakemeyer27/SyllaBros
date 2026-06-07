import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, Info, CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react';
import type { Course, Assignment, TermConfig } from '../types';
import { computeStudyBudget } from '../studyBudget';

interface Props {
  course: Course;
  assignments: Assignment[];
  termConfig: TermConfig;
  onUpdateAvgHw: (hours: number | null) => void;
}

const TYPE_LABELS: Record<string, string> = {
  exam: 'Exam', quiz: 'Quiz', homework: 'HW',
  project: 'Project', participation: 'Participation', other: 'Other',
};

const TYPE_COLORS: Record<string, string> = {
  exam: 'bg-crimson/15 text-crimson',
  quiz: 'bg-brand-orange/15 text-brand-orange',
  homework: 'bg-navy/10 text-navy',
  project: 'bg-emerald-100 text-emerald-700',
  participation: 'bg-gray-100 text-gray-600',
  other: 'bg-gray-100 text-gray-600',
};

export default function StudyBudgetPanel({ course, assignments, termConfig, onUpdateAvgHw }: Props) {
  const [open, setOpen] = useState(false);
  const [editingHw, setEditingHw] = useState(false);
  const [hwInput, setHwInput] = useState<string>(course.avgHomeworkHours?.toString() ?? '');

  const budget = useMemo(
    () => computeStudyBudget(course, assignments, termConfig),
    [course, assignments, termConfig]
  );

  const maxHours = Math.max(...budget.assignments.map(a => a.allocatedHours), 0.1);

  function saveHw() {
    const val = parseFloat(hwInput);
    onUpdateAvgHw(isNaN(val) || val <= 0 ? null : val);
    setEditingHw(false);
  }

  const hasAssignments = budget.assignments.length > 0;

  return (
    <div className="border-t border-gray-100 mt-3 pt-3">
      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-xs font-semibold text-gray-500 hover:text-navy transition-colors group"
      >
        <span className="flex items-center gap-1.5">
          <TrendingUp size={12} className="text-brand-orange" />
          Study Budget
          <span className="font-normal text-gray-400">
            · {budget.totalHours.toFixed(0)}h total · {budget.hoursPerWeek.toFixed(1)}h/wk
          </span>
        </span>
        {open
          ? <ChevronUp size={13} className="text-gray-400 group-hover:text-navy transition-colors" />
          : <ChevronDown size={13} className="text-gray-400 group-hover:text-navy transition-colors" />
        }
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-navy/5 rounded-xl p-2.5 text-center">
              <p className="text-lg font-bold text-navy">{budget.totalHours.toFixed(0)}h</p>
              <p className="text-[10px] text-gray-500 leading-tight mt-0.5">Total term</p>
            </div>
            <div className="bg-navy/5 rounded-xl p-2.5 text-center">
              <p className="text-lg font-bold text-navy">{budget.hoursPerWeek.toFixed(1)}h</p>
              <p className="text-[10px] text-gray-500 leading-tight mt-0.5">Per week</p>
            </div>
            <div className="bg-navy/5 rounded-xl p-2.5 text-center">
              <p className="text-lg font-bold text-navy">{course.creditHours}cr</p>
              <p className="text-[10px] text-gray-500 leading-tight mt-0.5">{budget.intensityLabel.split(' ')[0]}×/cr/wk</p>
            </div>
          </div>

          {/* Homework calibration */}
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Clock size={12} className="text-brand-orange flex-shrink-0" />
                <span className="text-xs font-semibold text-gray-700">Your avg homework time</span>
              </div>
              {!editingHw ? (
                <button
                  onClick={() => { setHwInput(course.avgHomeworkHours?.toString() ?? ''); setEditingHw(true); }}
                  className="text-xs text-navy font-medium hover:underline"
                >
                  {course.avgHomeworkHours != null ? `${course.avgHomeworkHours}h — edit` : 'Set it'}
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number" min={0.25} max={20} step={0.25}
                    value={hwInput}
                    onChange={e => setHwInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveHw(); if (e.key === 'Escape') setEditingHw(false); }}
                    autoFocus
                    placeholder="e.g. 2"
                    className="w-16 border border-gray-200 rounded-lg px-2 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-navy/30"
                  />
                  <span className="text-xs text-gray-400">hrs</span>
                  <button onClick={saveHw} className="text-xs bg-navy text-white px-2 py-0.5 rounded-md font-medium">Save</button>
                  <button onClick={() => setEditingHw(false)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                </div>
              )}
            </div>

            {/* Calibration status */}
            {budget.avgAllocatedHwHours != null && (
              <div className="mt-2">
                <p className="text-xs text-gray-500">
                  This course's homework averages{' '}
                  <span className="font-semibold text-gray-700">{budget.avgAllocatedHwHours.toFixed(1)}h</span>
                  {' '}per assignment.
                </p>
                {budget.hwCalibrationStatus && (
                  <div className={`flex items-start gap-1.5 mt-1.5 text-xs rounded-lg px-2.5 py-1.5 ${
                    budget.hwCalibrationStatus === 'under'    ? 'bg-crimson/8 text-crimson' :
                    budget.hwCalibrationStatus === 'over'     ? 'bg-emerald-50 text-emerald-700' :
                                                                'bg-emerald-50 text-emerald-700'
                  }`}>
                    {budget.hwCalibrationStatus === 'under' ? (
                      <><AlertTriangle size={11} className="mt-0.5 flex-shrink-0" />
                      You're budgeting less time than needed. Plan to spend more than your usual {course.avgHomeworkHours}h.</>
                    ) : budget.hwCalibrationStatus === 'over' ? (
                      <><CheckCircle2 size={11} className="mt-0.5 flex-shrink-0" />
                      You're putting in more than needed — you might have extra capacity.</>
                    ) : (
                      <><CheckCircle2 size={11} className="mt-0.5 flex-shrink-0" />
                      Your homework pace is right on target for this course.</>
                    )}
                  </div>
                )}
                {!budget.hwCalibrationStatus && course.avgHomeworkHours == null && (
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <Info size={11} /> Set your avg homework time above to see if you&apos;re on track.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Per-assignment breakdown */}
          {hasAssignments ? (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Time Breakdown by Assignment</p>
              {budget.assignments.map(b => {
                const barPct = (b.allocatedHours / maxHours) * 100;
                return (
                  <div key={b.assignmentId}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 ${TYPE_COLORS[b.type] ?? 'bg-gray-100 text-gray-500'}`}>
                        {TYPE_LABELS[b.type] ?? b.type}
                      </span>
                      <span className="text-xs text-gray-700 flex-1 truncate">{b.title}</span>
                      <span className="text-xs font-bold text-gray-800 flex-shrink-0">
                        {b.allocatedHours >= 10
                          ? `${b.allocatedHours.toFixed(0)}h`
                          : `${b.allocatedHours.toFixed(1)}h`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full transition-all"
                          style={{ width: `${barPct}%`, background: course.color }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-400 w-8 text-right flex-shrink-0">{b.weight}%</span>
                    </div>
                    {b.vsAvgNote && (
                      <p className={`text-[10px] mt-0.5 ml-0.5 ${
                        b.vsAvgNote.startsWith('+') ? 'text-brand-orange' :
                        b.vsAvgNote.startsWith('about') ? 'text-emerald-600' : 'text-gray-400'
                      }`}>
                        ↳ {b.vsAvgNote}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-400 text-center py-2">
              Add assignments to see the time breakdown.
            </p>
          )}

          {/* Footer note */}
          <p className="text-[10px] text-gray-400 leading-relaxed">
            Formula: {course.creditHours} credit hrs × {budget.intensityLabel} × {termConfig.weeksPerTerm} weeks.
            Exams weighted 1.8× and homework 0.7× their grade share before allocating time.
          </p>
        </div>
      )}
    </div>
  );
}
