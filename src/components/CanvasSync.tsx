import { useState } from 'react';
import {
  X, RefreshCw, Check, AlertTriangle, ExternalLink,
  Loader2, Link2,
} from 'lucide-react';
import type { Assignment, Course } from '../types';
import { apiUrl } from '../apiUrl';

const CANVAS_URL_KEY   = 'syllabros_canvas_url';
const CANVAS_TOKEN_KEY = 'syllabros_canvas_token';

interface CanvasAssignment {
  id: number;
  name: string;
  due_at: string | null;
  points_possible: number | null;
  submission: { score: number | null } | null;
}

interface CanvasCourse {
  canvasCourseId: number;
  courseName: string;
  courseCode: string;
  assignments: CanvasAssignment[];
}

interface GradeUpdate {
  assignment: Assignment;
  newScore: number;
  oldScore: number | null;
}

interface SyncResult {
  canvasCode: string;
  canvasName: string;
  matchedCourse: Course | null;
  updates: GradeUpdate[];
}

interface Props {
  courses: Course[];
  assignments: Assignment[];
  getToken: () => Promise<string | null>;
  onUpdate: (a: Assignment) => void;
  onClose: () => void;
}

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function titleMatch(a: string, b: string) {
  const na = norm(a);
  const nb = norm(b);
  return na === nb || na.includes(nb.slice(0, 12)) || nb.includes(na.slice(0, 12));
}

export default function CanvasSync({ courses, assignments, getToken, onUpdate, onClose }: Props) {
  const [canvasUrl, setCanvasUrl] = useState(localStorage.getItem(CANVAS_URL_KEY) ?? '');
  const [token, setToken]         = useState(localStorage.getItem(CANVAS_TOKEN_KEY) ?? '');
  const [status, setStatus]       = useState<'idle' | 'testing' | 'syncing' | 'done'>('idle');
  const [connected, setConnected] = useState(!!localStorage.getItem(CANVAS_TOKEN_KEY));
  const [connectedName, setConnectedName] = useState('');
  const [error, setError]         = useState('');
  const [results, setResults]     = useState<SyncResult[]>([]);
  const [applied, setApplied]     = useState(false);

  async function testConnection() {
    setError('');
    setStatus('testing');
    try {
      const auth = await getToken();
      const res = await fetch(apiUrl('/api/canvas/test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` },
        body: JSON.stringify({ canvasUrl: canvasUrl.trim(), token: token.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setError(data.error ?? 'Connection failed'); setStatus('idle'); return; }
      localStorage.setItem(CANVAS_URL_KEY, canvasUrl.trim());
      localStorage.setItem(CANVAS_TOKEN_KEY, token.trim());
      setConnected(true);
      setConnectedName(data.name ?? '');
      setStatus('idle');
    } catch (e) { setError(String(e)); setStatus('idle'); }
  }

  async function syncGrades() {
    setError('');
    setStatus('syncing');
    setResults([]);
    setApplied(false);
    try {
      const auth = await getToken();
      const res = await fetch(apiUrl('/api/canvas/sync'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` },
        body: JSON.stringify({ canvasUrl: canvasUrl.trim(), token: token.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Sync failed'); setStatus('idle'); return; }

      const canvasCourses = data.courses as CanvasCourse[];
      const syncResults: SyncResult[] = [];

      for (const cc of canvasCourses) {
        // Match Canvas course → SyllaBros course by code similarity
        const matchedCourse = courses.find(c =>
          norm(c.code).includes(norm(cc.courseCode).slice(0, 6)) ||
          norm(cc.courseCode).includes(norm(c.code).slice(0, 6))
        ) ?? null;

        const updates: GradeUpdate[] = [];

        if (matchedCourse) {
          for (const ca of cc.assignments) {
            if (ca.submission?.score == null) continue; // not graded yet
            const matched = assignments.find(a =>
              a.courseId === matchedCourse.id && titleMatch(a.title, ca.name)
            );
            if (matched) {
              updates.push({ assignment: matched, newScore: ca.submission.score, oldScore: matched.score });
            }
          }
        }

        // Only show courses that have something graded in Canvas
        const hasGrades = cc.assignments.some(a => a.submission?.score != null);
        if (hasGrades) {
          syncResults.push({ canvasCode: cc.courseCode, canvasName: cc.courseName, matchedCourse, updates });
        }
      }

      setResults(syncResults);
      setStatus('done');
    } catch (e) { setError(String(e)); setStatus('idle'); }
  }

  function applyAll() {
    for (const r of results) {
      for (const { assignment, newScore } of r.updates) {
        onUpdate({ ...assignment, score: newScore });
      }
    }
    setApplied(true);
  }

  const totalUpdates = results.reduce((s, r) => s + r.updates.length, 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-navy to-navy/80 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 text-white">
            <div className="w-9 h-9 bg-crimson rounded-xl flex items-center justify-center">
              <Link2 size={18} />
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight">Canvas Grade Sync</h2>
              <p className="text-white/60 text-xs">Auto-import your grades from Canvas LMS</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Settings */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Canvas URL</label>
              <input
                value={canvasUrl}
                onChange={e => { setCanvasUrl(e.target.value); setConnected(false); }}
                placeholder="https://smu.instructure.com"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">
                Access Token
                <a
                  href={canvasUrl.trim() ? `${canvasUrl.trim()}/profile/settings` : '#'}
                  target="_blank" rel="noreferrer"
                  className="ml-2 text-navy font-normal hover:underline inline-flex items-center gap-0.5"
                >
                  Get yours here <ExternalLink size={10} />
                </a>
              </label>
              <input
                type="password"
                value={token}
                onChange={e => { setToken(e.target.value); setConnected(false); }}
                placeholder="Paste your Canvas access token"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Canvas &rarr; Account &rarr; Settings &rarr; scroll to "Approved Integrations" &rarr; New Access Token
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-crimson/5 border border-crimson/20 rounded-xl px-3 py-2.5 text-xs text-crimson">
                <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" /> {error}
              </div>
            )}

            {connected && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 text-xs text-emerald-700">
                <Check size={13} /> Connected{connectedName ? ` as ${connectedName}` : ''}
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={testConnection}
                disabled={!canvasUrl.trim() || !token.trim() || status === 'testing'}
                className="flex items-center gap-1.5 px-4 py-2 border-2 border-navy text-navy text-sm font-semibold rounded-xl hover:bg-navy/5 transition-colors disabled:opacity-40"
              >
                {status === 'testing' ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Test Connection
              </button>
              {connected && (
                <button
                  onClick={syncGrades}
                  disabled={status === 'syncing'}
                  className="flex items-center gap-1.5 px-4 py-2 bg-navy text-white text-sm font-semibold rounded-xl hover:bg-navy/90 transition-colors disabled:opacity-40"
                >
                  {status === 'syncing' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  {status === 'syncing' ? 'Syncing…' : 'Sync Grades'}
                </button>
              )}
            </div>
          </div>

          {/* Results */}
          {status === 'done' && results.length === 0 && (
            <div className="text-center py-10 text-gray-400">
              <RefreshCw size={28} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No graded assignments found yet</p>
              <p className="text-sm mt-1">Your professors may not have posted grades yet.</p>
            </div>
          )}

          {status === 'done' && results.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-800">
                  {totalUpdates} grade{totalUpdates !== 1 ? 's' : ''} found
                  {totalUpdates === 0 ? ' (none matched SyllaBros assignments)' : ''}
                </p>
                {!applied && totalUpdates > 0 && (
                  <button
                    onClick={applyAll}
                    className="flex items-center gap-1.5 px-4 py-2 bg-navy text-white text-sm font-semibold rounded-xl hover:bg-navy/90"
                  >
                    <Check size={13} /> Apply All
                  </button>
                )}
                {applied && (
                  <span className="text-sm text-emerald-600 font-semibold flex items-center gap-1">
                    <Check size={14} /> Applied!
                  </span>
                )}
              </div>

              {results.map((r, i) => (
                <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
                  {/* Course row */}
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    {r.matchedCourse ? (
                      <>
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: r.matchedCourse.color }} />
                        <span className="text-xs font-bold text-gray-700">{r.matchedCourse.code}</span>
                        <span className="text-xs text-gray-400">&#8592; {r.canvasCode}</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={12} className="text-brand-orange flex-shrink-0" />
                        <span className="text-xs font-bold text-brand-orange">{r.canvasCode}</span>
                        <span className="text-xs text-gray-400">— not matched to any course in SyllaBros</span>
                      </>
                    )}
                  </div>
                  {/* Grade rows */}
                  {r.updates.length > 0 ? (
                    <div className="divide-y divide-gray-50">
                      {r.updates.map((u, j) => (
                        <div key={j} className="flex items-center justify-between px-4 py-2.5">
                          <p className="text-sm text-gray-700 truncate flex-1 mr-3">{u.assignment.title}</p>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {u.oldScore !== null && (
                              <span className="text-xs text-gray-300 line-through">{u.oldScore}</span>
                            )}
                            <span className="text-sm font-bold text-emerald-600">
                              {u.newScore}/{u.assignment.maxScore}
                            </span>
                            <span className="text-xs text-gray-400">
                              ({((u.newScore / u.assignment.maxScore) * 100).toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="px-4 py-3 text-xs text-gray-400 italic">
                      {r.matchedCourse
                        ? 'Canvas has grades but titles didn\'t match SyllaBros assignments — edit your assignment titles to match Canvas exactly.'
                        : 'Add this course to SyllaBros first so grades can be matched.'}
                    </p>
                  )}
                </div>
              ))}

              {/* Hint */}
              <p className="text-[11px] text-gray-400 text-center">
                Tip: assignment titles in SyllaBros need to roughly match Canvas names for auto-matching to work.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
