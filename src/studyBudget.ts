import type { Course, Assignment, TermConfig, AssignmentType } from './types';

// ─── Grade → study intensity ────────────────────────────────────────────────
// How many hours of OUTSIDE study per credit hour per week to hit each target.
// Source: standard 2–3 hr/credit rule, skewed higher for A-range targets.

const GRADE_MULTIPLIERS: { minGrade: number; hrsPerCreditPerWeek: number }[] = [
  { minGrade: 97, hrsPerCreditPerWeek: 3.5 },
  { minGrade: 93, hrsPerCreditPerWeek: 3.0 },
  { minGrade: 90, hrsPerCreditPerWeek: 2.7 },
  { minGrade: 87, hrsPerCreditPerWeek: 2.3 },
  { minGrade: 83, hrsPerCreditPerWeek: 2.0 },
  { minGrade: 80, hrsPerCreditPerWeek: 1.7 },
  { minGrade: 73, hrsPerCreditPerWeek: 1.4 },
  { minGrade: 0,  hrsPerCreditPerWeek: 1.2 },
];

export function getStudyIntensity(targetGrade: number): number {
  for (const m of GRADE_MULTIPLIERS) {
    if (targetGrade >= m.minGrade) return m.hrsPerCreditPerWeek;
  }
  return 1.2;
}

// ─── Assignment type → difficulty multiplier ────────────────────────────────
// Redistributes hours within a course: exams are harder per point than HW.
// These multiply the raw grade weight before normalizing — so total hours
// don't change, only how they're split.

const TYPE_MULTIPLIERS: Record<AssignmentType, number> = {
  exam:          1.8, // intensive prep, high stakes
  quiz:          1.1,
  project:       1.3, // sustained effort, but more self-paced
  homework:      0.7, // routine, lower cognitive load per point
  participation: 0.3, // minimal outside prep
  other:         1.0,
};

export function getTypeMultiplier(type: AssignmentType): number {
  return TYPE_MULTIPLIERS[type] ?? 1.0;
}

// ─── Per-assignment result ───────────────────────────────────────────────────

export interface AssignmentBudget {
  assignmentId: string;
  title: string;
  type: AssignmentType;
  weight: number;
  allocatedHours: number;
  // Homework calibration
  vsAvgNote: string | null; // null if no avgHomeworkHours set or not homework type
}

export interface StudyBudget {
  totalHours: number;         // full term
  hoursPerWeek: number;       // average per week
  intensityLabel: string;     // e.g. "3.0 hrs / credit / week"
  assignments: AssignmentBudget[];
  // Homework calibration summary
  avgAllocatedHwHours: number | null;
  hwCalibrationStatus: 'under' | 'over' | 'on-track' | null;
}

// ─── Main calculator ─────────────────────────────────────────────────────────

export function computeStudyBudget(
  course: Course,
  assignments: Assignment[],
  termConfig: TermConfig
): StudyBudget {
  const intensity = getStudyIntensity(course.targetGrade);
  const totalHours = course.creditHours * intensity * termConfig.weeksPerTerm;
  const hoursPerWeek = course.creditHours * intensity;

  const courseAssignments = assignments.filter(a => a.courseId === course.id);

  if (courseAssignments.length === 0) {
    return {
      totalHours,
      hoursPerWeek,
      intensityLabel: `${intensity.toFixed(1)} hrs / credit / week`,
      assignments: [],
      avgAllocatedHwHours: null,
      hwCalibrationStatus: null,
    };
  }

  // Step 1: raw weighted score for each assignment
  const raws = courseAssignments.map(a => ({
    a,
    raw: a.weight * getTypeMultiplier(a.type),
  }));

  const totalRaw = raws.reduce((s, r) => s + r.raw, 0);

  // Step 2: allocate hours proportionally from the total
  const hwAssignments: AssignmentBudget[] = [];
  const budgets: AssignmentBudget[] = raws.map(({ a, raw }) => {
    const allocatedHours = totalRaw > 0
      ? (raw / totalRaw) * totalHours
      : totalHours / courseAssignments.length;

    let vsAvgNote: string | null = null;
    if (a.type === 'homework' && course.avgHomeworkHours != null) {
      const diff = allocatedHours - course.avgHomeworkHours;
      const ratio = allocatedHours / course.avgHomeworkHours;
      if (ratio > 1.35) {
        vsAvgNote = `+${(diff).toFixed(1)}h more than your usual`;
      } else if (ratio < 0.7) {
        vsAvgNote = `${Math.abs(diff).toFixed(1)}h less than your usual`;
      } else {
        vsAvgNote = 'about your usual pace';
      }
    }

    const budget: AssignmentBudget = {
      assignmentId: a.id,
      title: a.title,
      type: a.type,
      weight: a.weight,
      allocatedHours,
      vsAvgNote,
    };

    if (a.type === 'homework') hwAssignments.push(budget);
    return budget;
  });

  // Homework calibration summary
  let avgAllocatedHwHours: number | null = null;
  let hwCalibrationStatus: StudyBudget['hwCalibrationStatus'] = null;

  if (hwAssignments.length > 0) {
    avgAllocatedHwHours = hwAssignments.reduce((s, b) => s + b.allocatedHours, 0) / hwAssignments.length;

    if (course.avgHomeworkHours != null) {
      const ratio = course.avgHomeworkHours / avgAllocatedHwHours;
      if (ratio < 0.7)       hwCalibrationStatus = 'under';
      else if (ratio > 1.35) hwCalibrationStatus = 'over';
      else                   hwCalibrationStatus = 'on-track';
    }
  }

  return {
    totalHours,
    hoursPerWeek,
    intensityLabel: `${intensity.toFixed(1)} hrs / credit / week`,
    assignments: budgets.sort((a, b) => b.allocatedHours - a.allocatedHours),
    avgAllocatedHwHours,
    hwCalibrationStatus,
  };
}
