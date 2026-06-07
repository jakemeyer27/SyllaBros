import { useState } from 'react';
import { X, Check, ChevronRight, ChevronLeft, Sun, Sunset, Moon, Sunrise, Zap, BookOpen, Clock, Calendar } from 'lucide-react';
import type { StudyPreferences } from '../types';
import { DEFAULT_STUDY_PREFS } from '../types';

interface Props {
  prefs: StudyPreferences;
  userName: string;
  onSave: (p: StudyPreferences) => void;
  onClose: () => void;
}

const DAYS = [
  { label: 'Su', full: 'Sunday',    value: 0 },
  { label: 'Mo', full: 'Monday',    value: 1 },
  { label: 'Tu', full: 'Tuesday',   value: 2 },
  { label: 'We', full: 'Wednesday', value: 3 },
  { label: 'Th', full: 'Thursday',  value: 4 },
  { label: 'Fr', full: 'Friday',    value: 5 },
  { label: 'Sa', full: 'Saturday',  value: 6 },
];

const SESSION_OPTIONS = [
  { value: 25,  label: '25 min',  sub: 'Pomodoro' },
  { value: 30,  label: '30 min',  sub: 'Quick focus' },
  { value: 45,  label: '45 min',  sub: 'Standard' },
  { value: 60,  label: '1 hr',    sub: 'Deep work' },
  { value: 90,  label: '90 min',  sub: 'Power session' },
];

const STYLE_OPTIONS: { value: StudyPreferences['studyStyle']; label: string; sub: string; emoji: string }[] = [
  { value: 'spread',   label: 'Spread it out',     sub: 'Start early, little each day',       emoji: '📅' },
  { value: 'balanced', label: 'Balanced',           sub: 'Mix of early and near deadline',     emoji: '⚖️' },
  { value: 'crunch',   label: 'Closer to deadline', sub: 'Study intensely in the final days',  emoji: '⚡' },
];

const PEAK_OPTIONS: { value: StudyPreferences['productivityPeak']; label: string; hours: string; icon: React.ReactNode }[] = [
  { value: 'morning',   label: 'Morning',   hours: '6 am – 12 pm', icon: <Sunrise size={20} /> },
  { value: 'afternoon', label: 'Afternoon', hours: '12 pm – 5 pm', icon: <Sun size={20} /> },
  { value: 'evening',   label: 'Evening',   hours: '5 pm – 9 pm',  icon: <Sunset size={20} /> },
  { value: 'night',     label: 'Night owl', hours: '9 pm – 2 am',  icon: <Moon size={20} /> },
];

const STEPS = ['Peak time', 'Study days', 'Session length', 'Study style'];

export default function ProfileModal({ prefs, userName, onSave, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<StudyPreferences>({ ...prefs });

  function toggleDay(d: number) {
    setDraft(p => ({
      ...p,
      preferredDays: p.preferredDays.includes(d)
        ? p.preferredDays.filter(x => x !== d)
        : [...p.preferredDays, d].sort(),
    }));
  }

  function finish() {
    onSave(draft);
    onClose();
  }

  const canNext = step === 1 ? draft.preferredDays.length > 0 : true;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-navy to-navy/80 px-6 py-5 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-white/60 text-xs mb-0.5">Study Profile</p>
            <h2 className="font-bold text-white text-lg leading-tight">
              Hey, {userName.split(' ')[0]} 👋
            </h2>
            <p className="text-white/60 text-xs mt-0.5">Let's personalise your study plan</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex border-b border-gray-100 px-6 py-2.5 gap-1 flex-shrink-0">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border flex-shrink-0 ${
                i < step ? 'bg-navy border-navy text-white' : i === step ? 'bg-navy border-navy text-white' : 'border-gray-200 text-gray-400'
              }`}>
                {i < step ? <Check size={10} /> : i + 1}
              </div>
              <span className={`text-[10px] font-medium truncate ${i === step ? 'text-navy' : 'text-gray-400'}`}>{s}</span>
              {i < STEPS.length - 1 && <div className="flex-1 h-px bg-gray-100 mx-1" />}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto">

          {/* Step 0 — Productivity peak */}
          {step === 0 && (
            <div className="space-y-3">
              <div className="mb-4">
                <h3 className="font-bold text-gray-800">When do you focus best?</h3>
                <p className="text-xs text-gray-400 mt-0.5">Your study blocks will be scheduled around this window</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {PEAK_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setDraft(p => ({ ...p, productivityPeak: opt.value }))}
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                      draft.productivityPeak === opt.value
                        ? 'border-navy bg-navy/5 text-navy'
                        : 'border-gray-100 text-gray-500 hover:border-gray-200'
                    }`}
                  >
                    <span className={draft.productivityPeak === opt.value ? 'text-navy' : 'text-gray-400'}>
                      {opt.icon}
                    </span>
                    <span className="font-semibold text-sm">{opt.label}</span>
                    <span className="text-[11px] text-gray-400">{opt.hours}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1 — Study days */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-gray-800">Which days do you like to study?</h3>
                <p className="text-xs text-gray-400 mt-0.5">Study blocks will only be placed on these days</p>
              </div>
              <div className="flex gap-2 justify-between">
                {DAYS.map(d => (
                  <button
                    key={d.value}
                    onClick={() => toggleDay(d.value)}
                    className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border-2 text-xs font-bold transition-all ${
                      draft.preferredDays.includes(d.value)
                        ? 'border-navy bg-navy text-white'
                        : 'border-gray-100 text-gray-500 hover:border-gray-200'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              {draft.preferredDays.length === 0 && (
                <p className="text-xs text-crimson text-center">Pick at least one day</p>
              )}
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setDraft(p => ({ ...p, preferredDays: [1,2,3,4,5] }))}
                  className="text-xs text-navy hover:underline">Weekdays only</button>
                <span className="text-gray-200">·</span>
                <button onClick={() => setDraft(p => ({ ...p, preferredDays: [0,6] }))}
                  className="text-xs text-navy hover:underline">Weekends only</button>
                <span className="text-gray-200">·</span>
                <button onClick={() => setDraft(p => ({ ...p, preferredDays: [0,1,2,3,4,5,6] }))}
                  className="text-xs text-navy hover:underline">Every day</button>
              </div>
            </div>
          )}

          {/* Step 2 — Session length */}
          {step === 2 && (
            <div className="space-y-3">
              <div>
                <h3 className="font-bold text-gray-800">How long is your ideal study session?</h3>
                <p className="text-xs text-gray-400 mt-0.5">Each generated study block will use this duration</p>
              </div>
              <div className="space-y-2">
                {SESSION_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setDraft(p => ({ ...p, sessionDuration: opt.value }))}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                      draft.sessionDuration === opt.value
                        ? 'border-navy bg-navy/5'
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Clock size={16} className={draft.sessionDuration === opt.value ? 'text-navy' : 'text-gray-400'} />
                      <span className={`font-semibold text-sm ${draft.sessionDuration === opt.value ? 'text-navy' : 'text-gray-700'}`}>
                        {opt.label}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">{opt.sub}</span>
                    {draft.sessionDuration === opt.value && <Check size={15} className="text-navy ml-2" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3 — Study style */}
          {step === 3 && (
            <div className="space-y-3">
              <div>
                <h3 className="font-bold text-gray-800">How do you prefer to study?</h3>
                <p className="text-xs text-gray-400 mt-0.5">This shapes when study blocks appear relative to deadlines</p>
              </div>
              <div className="space-y-3">
                {STYLE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setDraft(p => ({ ...p, studyStyle: opt.value }))}
                    className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl border-2 transition-all text-left ${
                      draft.studyStyle === opt.value
                        ? 'border-navy bg-navy/5'
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <span className="text-2xl">{opt.emoji}</span>
                    <div className="flex-1">
                      <p className={`font-semibold text-sm ${draft.studyStyle === opt.value ? 'text-navy' : 'text-gray-700'}`}>
                        {opt.label}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{opt.sub}</p>
                    </div>
                    {draft.studyStyle === opt.value && <Check size={16} className="text-navy flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-between bg-white flex-shrink-0">
          <button
            onClick={() => step > 0 ? setStep(s => s - 1) : onClose()}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <ChevronLeft size={15} />
            {step === 0 ? 'Cancel' : 'Back'}
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-navy text-white font-semibold text-sm rounded-xl hover:bg-navy/90 transition-colors disabled:opacity-40"
            >
              Next <ChevronRight size={15} />
            </button>
          ) : (
            <button
              onClick={finish}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-navy text-white font-semibold text-sm rounded-xl hover:bg-navy/90 transition-colors"
            >
              <Zap size={15} /> Save & Apply
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
