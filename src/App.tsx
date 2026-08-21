import { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, BookOpen, ClipboardList, BarChart2, GraduationCap, LogOut, Loader2, Settings2, HelpCircle, Flame, Brain, Bell, BellOff, X, CalendarDays } from 'lucide-react';
import { useNotifications, requestNotificationPermission, getNotificationPermission } from './hooks/useNotifications';
import { getSession, signIn, signUp, clearAuth, getJWTToken } from './auth';
import type { SessionUser } from './auth';
import { useAppState } from './store';
import Dashboard from './components/Dashboard';
import Courses from './components/Courses';
import Assignments from './components/Assignments';
import Schedule from './components/Schedule';
import Grades from './components/Grades';
import StudyPlan from './components/StudyPlan';
import SchoolSetup from './components/SchoolSetup';
import OutsideHelp from './components/OutsideHelp';
import CalendarView from './components/CalendarView';
import ProfileModal from './components/ProfileModal';
import NotificationCenter from './components/NotificationCenter';
import type { OfficeHours, StudyPreferences, ClassMeeting, SemesterRecord } from './types';
import { DEFAULT_STUDY_PREFS } from './types';
import { getScaleById, getDefaultScale } from './gradingScales';
import type { GradingScale } from './gradingScales';
import { TERM_CONFIGS } from './types';
import type { TermType, TermConfig } from './types';
import './index.css';

const SCHOOL_KEY = 'syllabros_school_scale';
const TERM_KEY  = 'syllabros_term_type';

type Tab = 'dashboard' | 'study-plan' | 'courses' | 'assignments' | 'calendar' | 'schedule' | 'grades' | 'help';


const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard',   label: 'Dashboard',    icon: <LayoutDashboard size={18} /> },
  { id: 'study-plan',  label: 'Study Plan',   icon: <Brain size={18} /> },
  { id: 'schedule',    label: 'Schedule',     icon: <BarChart2 size={18} /> },
  { id: 'courses',     label: 'Courses',      icon: <BookOpen size={18} /> },
  { id: 'grades',      label: 'Grades',       icon: <GraduationCap size={18} /> },
  { id: 'assignments', label: 'Syllabus',     icon: <ClipboardList size={18} /> },
  { id: 'calendar',   label: 'Calendar',     icon: <CalendarDays size={18} /> },
  { id: 'help',        label: 'Outside Help', icon: <HelpCircle size={18} /> },
];

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    getSession().then(user => { setUser(user); setAuthLoading(false); })
      .catch(() => setAuthLoading(false));
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-navy" />
      </div>
    );
  }

  if (!user) {
    return <SignInPage onSignedIn={setUser} />;
  }

  return <AuthedApp user={user} onSignOut={() => setUser(null)} />;
}

const STREAK_KEY = 'syllabros_streak';

function getOrUpdateStreak(): number {
  const todayStr = new Date().toISOString().slice(0, 10);
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (!raw) {
      localStorage.setItem(STREAK_KEY, JSON.stringify({ last: todayStr, streak: 1 }));
      return 1;
    }
    const { last, streak } = JSON.parse(raw) as { last: string; streak: number };
    if (last === todayStr) return streak; // same day, no change

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().slice(0, 10);

    const next = last === yStr ? streak + 1 : 1; // consecutive → extend, else reset
    localStorage.setItem(STREAK_KEY, JSON.stringify({ last: todayStr, streak: next }));
    return next;
  } catch { return 1; }
}

function flameStyle(streak: number): { color: string; label: string } {
  if (streak >= 30) return { color: '#a855f7', label: 'purple' }; // purple — 1 month+
  if (streak >= 14) return { color: '#3b82f6', label: 'blue' };   // blue — 2 weeks+
  if (streak >= 7)  return { color: '#ef4444', label: 'red' };    // red — 1 week+
  return { color: '#f97316', label: 'orange' };                    // orange — just started
}

function AuthedApp({ user, onSignOut }: { user: SessionUser; onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>('dashboard');
  const today = new Date();
  const [showSchoolSetup, setShowSchoolSetup] = useState(false);
  const [streak] = useState<number>(() => getOrUpdateStreak());

  // Study preferences
  const PREFS_KEY = 'syllabros_study_prefs';
  const [studyPrefs, setStudyPrefs] = useState<StudyPreferences>(() => {
    try { return { ...DEFAULT_STUDY_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') }; }
    catch { return DEFAULT_STUDY_PREFS; }
  });
  const [showProfile, setShowProfile] = useState(false);

  function savePrefs(p: StudyPreferences) {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
    setStudyPrefs(p);
  }

  // Load persisted scale — show setup modal on first login
  const [gradingScale, setGradingScale] = useState<GradingScale>(() => {
    const saved = localStorage.getItem(SCHOOL_KEY);
    if (saved) return getScaleById(saved);
    return getDefaultScale();
  });

  // If no school has been saved yet, prompt on first render
  useEffect(() => {
    if (!localStorage.getItem(SCHOOL_KEY)) {
      setShowSchoolSetup(true);
    }
  }, []);

  function applyScale(scale: GradingScale) {
    localStorage.setItem(SCHOOL_KEY, scale.id);
    setGradingScale(scale);
    setShowSchoolSetup(false);
  }

  // Term type (semester / trimester / quarter)
  const [termConfig, setTermConfig] = useState<TermConfig>(() => {
    const saved = localStorage.getItem(TERM_KEY) as TermType | null;
    return TERM_CONFIGS[saved ?? 'semester'];
  });

  function applyTermType(type: TermType) {
    localStorage.setItem(TERM_KEY, type);
    setTermConfig(TERM_CONFIGS[type]);
  }

  // Class meetings — stored in localStorage
  const CLASS_KEY = 'syllabros_class_meetings';
  const [classMeetings, setClassMeetings] = useState<ClassMeeting[]>(() => {
    try { return JSON.parse(localStorage.getItem(CLASS_KEY) ?? '[]'); }
    catch { return []; }
  });
  function addClassMeeting(m: ClassMeeting) {
    setClassMeetings(prev => { const next = [...prev, m]; localStorage.setItem(CLASS_KEY, JSON.stringify(next)); return next; });
  }
  function deleteClassMeeting(id: string) {
    setClassMeetings(prev => { const next = prev.filter(m => m.id !== id); localStorage.setItem(CLASS_KEY, JSON.stringify(next)); return next; });
  }

  // Comprehension scores per course — stored in localStorage
  const COMP_KEY = 'syllabros_comprehension';
  const [comprehensionScores, setComprehensionScores] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem(COMP_KEY) ?? '{}'); }
    catch { return {}; }
  });
  function updateComprehension(courseId: string, score: number) {
    setComprehensionScores(prev => {
      const next = { ...prev };
      if (score > 0) next[courseId] = score;
      else delete next[courseId];  // score=0 means clear
      localStorage.setItem(COMP_KEY, JSON.stringify(next));
      return next;
    });
  }

  // Semester GPA history — stored in localStorage
  const HIST_KEY = 'syllabros_semester_history';
  const [semesterHistory, setSemesterHistory] = useState<SemesterRecord[]>(() => {
    try { return JSON.parse(localStorage.getItem(HIST_KEY) ?? '[]'); }
    catch { return []; }
  });
  function addSemester(s: SemesterRecord) {
    setSemesterHistory(prev => { const next = [...prev, s]; localStorage.setItem(HIST_KEY, JSON.stringify(next)); return next; });
  }
  function deleteSemester(id: string) {
    setSemesterHistory(prev => { const next = prev.filter(s => s.id !== id); localStorage.setItem(HIST_KEY, JSON.stringify(next)); return next; });
  }

  // Office hours — stored in localStorage (no DB needed)
  const OH_KEY = 'syllabros_office_hours';
  const [officeHours, setOfficeHours] = useState<OfficeHours[]>(() => {
    try { return JSON.parse(localStorage.getItem(OH_KEY) ?? '[]'); }
    catch { return []; }
  });

  function addOfficeHours(ohs: OfficeHours[]) {
    setOfficeHours(prev => {
      const next = [...prev, ...ohs];
      localStorage.setItem(OH_KEY, JSON.stringify(next));
      return next;
    });
  }

  function deleteOfficeHours(id: string) {
    setOfficeHours(prev => {
      const next = prev.filter(oh => oh.id !== id);
      localStorage.setItem(OH_KEY, JSON.stringify(next));
      return next;
    });
  }

  // Completion status — stored in localStorage; separate from grading so
  // students can mark "submitted / done" before a grade comes back.
  const DONE_KEY = 'syllabros_completed';
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(DONE_KEY) ?? '[]') as string[]); }
    catch { return new Set<string>(); }
  });
  function toggleCompleted(id: string) {
    setCompletedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem(DONE_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  // ── Notifications ──────────────────────────────────────────────────────────
  const NOTIF_KEY = 'sb_notif_enabled';
  const [notifEnabled, setNotifEnabled] = useState<boolean>(
    () => localStorage.getItem(NOTIF_KEY) === 'true'
  );
  const [showNotifBanner, setShowNotifBanner] = useState<boolean>(
    () => getNotificationPermission() === 'default' && localStorage.getItem(NOTIF_KEY) !== 'false'
  );

  async function enableNotifications() {
    const perm = await requestNotificationPermission();
    if (perm === 'granted') {
      localStorage.setItem(NOTIF_KEY, 'true');
      setNotifEnabled(true);
    }
    setShowNotifBanner(false);
  }

  function dismissNotifBanner() {
    localStorage.setItem(NOTIF_KEY, 'false');
    setShowNotifBanner(false);
  }

  // getJWTToken() produces a signed JWT — the correct way to auth against
  // a separate API server. The backend verifies it via the JWKS endpoint.
  const getToken = useCallback(() => getJWTToken(), []);

  const {
    state, loading, error,
    addCourse, updateCourse, deleteCourse: deleteCourseBase,
    addAssignment, updateAssignment, deleteAssignment,
    addStudyBlock, toggleStudyBlock, deleteStudyBlock, saveGeneratedBlocks,
  } = useAppState(getToken);

  // Cascade-delete: when a course is removed, wipe its class meetings + office hours too
  function deleteCourse(id: string) {
    setClassMeetings(prev => {
      const next = prev.filter(m => m.courseId !== id);
      localStorage.setItem(CLASS_KEY, JSON.stringify(next));
      return next;
    });
    setOfficeHours(prev => {
      const next = prev.filter(oh => oh.courseId !== id);
      localStorage.setItem(OH_KEY, JSON.stringify(next));
      return next;
    });
    deleteCourseBase(id);
  }

  useNotifications({
    courses: state.courses,
    assignments: state.assignments,
    studyBlocks: state.studyBlocks,
    today,
    termConfig,
    enabled: notifEnabled,
  });

  async function handleSignOut() {
    clearAuth();
    onSignOut();
  }

  return (
    <div className="min-h-screen bg-app flex flex-col">
      {/* Profile / study preferences modal */}
      {showProfile && (
        <ProfileModal
          prefs={studyPrefs}
          userName={user.name ?? user.email ?? 'Student'}
          onSave={savePrefs}
          onClose={() => setShowProfile(false)}
        />
      )}

      {/* School setup modal */}
      {showSchoolSetup && (
        <SchoolSetup
          currentScaleId={gradingScale.id}
          onConfirm={applyScale}
          onCancel={localStorage.getItem(SCHOOL_KEY) ? () => setShowSchoolSetup(false) : undefined}
          isModal
        />
      )}

      {/* Top nav — unified header + tab bar */}
      <header
        className="sticky top-0 z-10"
        style={{
          background: 'linear-gradient(180deg, #062642 0%, #083152 100%)',
          boxShadow: '0 6px 32px rgba(6, 38, 66, 0.55), 0 2px 8px rgba(0,0,0,0.25)',
          borderBottom: '4px solid #C4202A',
        }}
      >
        {/* Brand row */}
        <div className="max-w-5xl mx-auto px-4 pt-3 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
<div
              className="w-11 h-11 rounded-xl flex-shrink-0 overflow-hidden"
              style={{ boxShadow: '0 0 0 2px rgba(196,32,42,0.8), 0 4px 14px rgba(0,0,0,0.45)' }}
            >
              <img src="/sb-logo.png" alt="SyllaBros" className="w-full h-full object-cover" />
            </div>
            <div>
              <span className="font-black text-white text-xl tracking-tight">SyllaBros</span>
              <span className="hidden sm:inline text-xs text-white/40 font-medium ml-2">Smart Study Planner</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/40 hidden sm:block">
              {today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
            {/* School / scale */}
            <button
              onClick={() => setShowSchoolSetup(true)}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              title="Change grading scale"
            >
              <Settings2 size={12} className="text-white/50" />
              <span className="text-xs text-white/60 font-semibold">{gradingScale.shortName}</span>
            </button>
            {/* Notifications */}
            <NotificationCenter
              courses={state.courses}
              assignments={state.assignments}
              studyBlocks={state.studyBlocks}
              today={today}
              onNavigate={(t) => setTab(t as Tab)}
            />
            {/* Push notif toggle */}
            {getNotificationPermission() !== 'unsupported' && (
              <button
                onClick={async () => {
                  if (!notifEnabled) {
                    await enableNotifications();
                  } else {
                    localStorage.setItem(NOTIF_KEY, 'false');
                    setNotifEnabled(false);
                  }
                }}
                title={notifEnabled ? 'Notifications on — click to disable' : 'Enable push notifications'}
                className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
              >
                {notifEnabled
                  ? <Bell size={15} className="text-amber-warm" />
                  : <BellOff size={15} className="text-white/40" />
                }
              </button>
            )}
            {/* Streak */}
            <div
              className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10"
              title={`${streak}-day streak`}
            >
              <Flame size={13} style={{ color: flameStyle(streak).color }} />
              <span className="text-xs font-bold" style={{ color: flameStyle(streak).color }}>{streak}</span>
            </div>
            {/* Avatar */}
            <button
              onClick={() => setShowProfile(true)}
              title="Study preferences"
              className="w-8 h-8 rounded-full bg-amber-warm flex items-center justify-center text-xs font-black text-navy hover:bg-amber-warm/80 transition-colors shadow-md"
            >
              {(user.name ?? user.email ?? '?')[0].toUpperCase()}
            </button>
            <button
              onClick={handleSignOut}
              className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="max-w-5xl mx-auto px-4 pb-2">
          <nav className="flex gap-0.5 overflow-x-auto">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold whitespace-nowrap rounded-xl transition-all ${
                  tab === t.id
                    ? 'bg-amber-warm text-navy shadow-md shadow-amber-warm/30'
                    : 'text-white/55 hover:text-white hover:bg-white/10'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Notification permission banner */}
      {showNotifBanner && (
        <div className="bg-navy/95 border-b border-amber-warm/30">
          <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Bell size={15} className="text-amber-warm flex-shrink-0" />
              <p className="text-sm text-white/80">
                Get notified about <span className="text-amber-warm font-semibold">crunch weeks</span> and <span className="text-amber-warm font-semibold">study block reminders</span>
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={enableNotifications}
                className="px-3 py-1 bg-amber-warm text-navy text-xs font-bold rounded-lg hover:bg-amber-warm/90 transition-colors"
              >
                Enable
              </button>
              <button onClick={dismissNotifBanner} className="p-1 text-white/40 hover:text-white transition-colors">
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-navy/60" />
          </div>
        ) : error ? (
          <div className="bg-crimson/5 border border-crimson/20 rounded-xl p-4 text-crimson text-sm">
            <strong>Error loading data:</strong> {error}
            <p className="mt-1 text-xs">Make sure your API server is running and .env.local is configured.</p>
          </div>
        ) : (
          <>
            {tab === 'dashboard' && (
              <Dashboard
                courses={state.courses}
                assignments={state.assignments}
                studyBlocks={state.studyBlocks}
                today={today}
                onNavigate={setTab as (tab: string) => void}
                gradingScale={gradingScale}
                termConfig={termConfig}
              />
            )}
            {tab === 'study-plan' && (
              <StudyPlan
                courses={state.courses}
                assignments={state.assignments}
                studyBlocks={state.studyBlocks}
                today={today}
                termConfig={termConfig}
                studyPrefs={studyPrefs}
                comprehensionScores={comprehensionScores}
                onUpdateComprehension={updateComprehension}
                onSaveGenerated={saveGeneratedBlocks}
                getToken={getToken}
              />
            )}
            {tab === 'courses' && (
              <Courses
                courses={state.courses}
                assignments={state.assignments}
                termConfig={termConfig}
                onAdd={addCourse}
                onUpdate={updateCourse}
                onDelete={deleteCourse}
              />
            )}
            {tab === 'assignments' && (
              <Assignments
                courses={state.courses}
                assignments={state.assignments}
                today={today}
                getToken={getToken}
                completedIds={completedIds}
                onToggleCompleted={toggleCompleted}
                onAdd={addAssignment}
                onUpdate={updateAssignment}
                onDelete={deleteAssignment}
                onAddOfficeHours={addOfficeHours}
              />
            )}
            {tab === 'calendar' && (
              <CalendarView
                courses={state.courses}
                assignments={state.assignments}
                studyBlocks={state.studyBlocks}
                today={today}
                completedIds={completedIds}
              />
            )}
            {tab === 'schedule' && (
              <Schedule
                courses={state.courses}
                assignments={state.assignments}
                studyBlocks={state.studyBlocks}
                today={today}
                completedIds={completedIds}
                onToggleCompleted={toggleCompleted}
                onToggle={toggleStudyBlock}
                onDelete={deleteStudyBlock}
                onSaveGenerated={saveGeneratedBlocks}
                onAddBlock={addStudyBlock}
                termConfig={termConfig}
                studyPrefs={studyPrefs}
                classMeetings={classMeetings}
                onAddMeeting={addClassMeeting}
                onDeleteMeeting={deleteClassMeeting}
                comprehensionScores={comprehensionScores}
              />
            )}
            {tab === 'grades' && (
              <Grades
                courses={state.courses}
                assignments={state.assignments}
                gradingScale={gradingScale}
                termConfig={termConfig}
                onTermChange={applyTermType}
                onUpdate={updateAssignment}
                onUpdateCourse={updateCourse}
                semesterHistory={semesterHistory}
                onAddSemester={addSemester}
                onDeleteSemester={deleteSemester}
              />
            )}
            {tab === 'help' && (
              <OutsideHelp
                courses={state.courses}
                assignments={state.assignments}
                officeHours={officeHours}
                today={today}
                onAddOfficeHours={addOfficeHours}
                onDeleteOfficeHours={deleteOfficeHours}
                classMeetings={classMeetings}
                studyBlocks={state.studyBlocks}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function SignInPage({ onSignedIn }: { onSignedIn: (user: SessionUser) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = mode === 'signin'
        ? await signIn(email, password)
        : await signUp(name, email, password);
      onSignedIn(user);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy via-navy/90 to-navy/80 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-crimson rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <GraduationCap size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">SyllaBros</h1>
          <p className="text-white/60 mt-1 text-sm">Smart study planner that adapts to your grades</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex gap-1 mb-5 p-1 bg-gray-100 rounded-lg">
            {(['signin', 'signup'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${mode === m ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                {m === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === 'signup' && (
              <input type="text" placeholder="Full name" value={name}
                onChange={e => setName(e.target.value)} required
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
            )}
            <input type="email" placeholder="Email" value={email}
              onChange={e => setEmail(e.target.value)} required
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
            <input type="password" placeholder="Password" value={password}
              onChange={e => setPassword(e.target.value)} required
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
            {error && <p className="text-xs text-crimson">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-navy text-white font-semibold rounded-lg hover:bg-navy/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {loading && <Loader2 size={15} className="animate-spin" />}
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-gray-400 mt-4">Powered by Neon Auth</p>
      </div>
    </div>
  );
}
