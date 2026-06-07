import { useState, useMemo } from 'react';
import { Search, GraduationCap, Check, ChevronRight, BookOpen } from 'lucide-react';
import { GRADING_SCALES, getScaleById } from '../gradingScales';
import type { GradingScale } from '../gradingScales';

interface Props {
  currentScaleId?: string;
  onConfirm: (scale: GradingScale) => void;
  onCancel?: () => void;
  isModal?: boolean;
}

// Quick-pick sections shown before "Show all schools"
const QUICK_SECTIONS: { label: string; ids: string[] }[] = [
  {
    label: '🎓 Generic Scales',
    ids: ['generic-plus-minus', 'generic-no-plus-minus', 'generic-a-plus'],
  },
  {
    label: '🏛️ Ivy League',
    ids: ['harvard', 'yale', 'princeton', 'columbia', 'upenn', 'dartmouth', 'cornell', 'brown'],
  },
  {
    label: '⭐ Top Schools',
    ids: ['mit', 'stanford', 'chicago', 'duke', 'northwestern', 'johns-hopkins'],
  },
  {
    label: '🤘 Texas',
    ids: ['smu', 'ut-austin', 'texas-am', 'tcu', 'baylor', 'rice'],
  },
];

export default function SchoolSetup({ currentScaleId, onConfirm, onCancel, isModal }: Props) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<GradingScale>(
    currentScaleId ? getScaleById(currentScaleId) : GRADING_SCALES[0]
  );
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GRADING_SCALES;
    return GRADING_SCALES.filter(s =>
      s.name.toLowerCase().includes(q) || s.shortName.toLowerCase().includes(q)
    );
  }, [query]);

  const maxGpa = Math.max(...selected.grades.map(g => g.points));

  return (
    <div className={isModal ? 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4' : ''}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-navy to-navy/80 px-6 py-5 text-white flex-shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-crimson rounded-xl flex items-center justify-center">
              <GraduationCap size={22} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Select Your School</h2>
              <p className="text-white/60 text-xs">
                GPA is calculated using your school's exact grading scale
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Left: school picker */}
          <div className="flex flex-col md:w-[55%] border-r border-gray-100 overflow-hidden">
            {/* Search */}
            <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search school or scale name…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/30"
                />
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1">
              {/* Search results */}
              {query.trim() ? (
                <>
                  {filtered.map(scale => (
                    <ScaleRow key={scale.id} scale={scale} selected={selected} onSelect={setSelected} />
                  ))}
                  {filtered.length === 0 && (
                    <div className="text-center py-8">
                      <BookOpen size={28} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-sm text-gray-500">No schools matched "{query}"</p>
                      <p className="text-xs text-gray-400 mt-1">Try the generic scales at the top</p>
                    </div>
                  )}
                </>
              ) : showAll ? (
                /* All schools flat list */
                GRADING_SCALES.map(scale => (
                  <ScaleRow key={scale.id} scale={scale} selected={selected} onSelect={setSelected} />
                ))
              ) : (
                /* Grouped quick-pick sections */
                <>
                  {QUICK_SECTIONS.map(section => (
                    <div key={section.label}>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-4 pt-3 pb-1">
                        {section.label}
                      </p>
                      {section.ids
                        .map(id => GRADING_SCALES.find(s => s.id === id))
                        .filter(Boolean)
                        .map(scale => (
                          <ScaleRow key={scale!.id} scale={scale!} selected={selected} onSelect={setSelected} />
                        ))
                      }
                    </div>
                  ))}
                  <button
                    onClick={() => setShowAll(true)}
                    className="w-full text-center py-2.5 text-xs text-navy font-medium hover:bg-navy/5 transition-colors flex items-center justify-center gap-1 mt-1"
                  >
                    Show all schools <ChevronRight size={12} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Right: preview */}
          <div className="md:w-[45%] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <h3 className="font-semibold text-gray-800 text-sm">{selected.shortName}</h3>
              <p className="text-xs text-gray-500 mt-0.5">Max GPA: {maxGpa.toFixed(1)}</p>
              {selected.notes && (
                <p className="text-xs text-brand-orange mt-1 italic">{selected.notes}</p>
              )}
            </div>

            <div className="overflow-y-auto flex-1 p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
                    <th className="text-left pb-2">Grade</th>
                    <th className="text-left pb-2">Min %</th>
                    <th className="text-right pb-2">GPA pts</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.grades.map((g, i) => {
                    const prev = selected.grades[i - 1]; // grade above (higher score)
                    const range = prev
                      ? `${g.minPercent}–${prev.minPercent - 1}%`
                      : `${g.minPercent}%+`;
                    return (
                      <tr key={g.letter} className="border-t border-gray-50">
                        <td className="py-1.5">
                          <span className={`font-bold ${
                            g.points >= 3.7 ? 'text-emerald-600' :
                            g.points >= 3.0 ? 'text-navy' :
                            g.points >= 2.0 ? 'text-brand-orange' :
                            g.points >= 1.0 ? 'text-crimson/70' : 'text-crimson'
                          }`}>{g.letter}</span>
                        </td>
                        <td className="py-1.5 text-gray-500 text-xs">{range}</td>
                        <td className="py-1.5 text-right font-semibold text-gray-700">
                          {g.points.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="flex gap-2 p-4 border-t border-gray-100 flex-shrink-0">
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={() => onConfirm(selected)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-navy text-white hover:bg-navy/90 transition-colors flex items-center justify-center gap-1.5"
              >
                <Check size={15} /> Use This Scale
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScaleRow({ scale, selected, onSelect }: {
  scale: GradingScale;
  selected: GradingScale;
  onSelect: (s: GradingScale) => void;
}) {
  const isActive = selected.id === scale.id;
  return (
    <button
      onClick={() => onSelect(scale)}
      className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors hover:bg-navy/5 ${
        isActive ? 'bg-navy/5 border-l-2 border-navy' : 'border-l-2 border-transparent'
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isActive ? 'text-navy' : 'text-gray-800'}`}>
          {scale.name}
        </p>
        <p className="text-xs text-gray-400">{scaleTypeLabel(scale)}</p>
      </div>
      {isActive && <Check size={14} className="text-navy flex-shrink-0" />}
    </button>
  );
}

function scaleTypeLabel(scale: GradingScale): string {
  const hasPlusMinus = scale.grades.some(g => g.letter.includes('+') || g.letter.includes('-'));
  const hasAPlus43 = scale.grades.some(g => g.letter === 'A+' && g.points > 4.0);
  if (hasAPlus43) return 'Plus/Minus · A+ = 4.3';
  if (hasPlusMinus) return 'Plus/Minus · 4.0 max';
  return 'No Plus/Minus · 4.0 max';
}
