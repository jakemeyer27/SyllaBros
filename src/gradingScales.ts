export interface GradePoint {
  minPercent: number;
  letter: string;
  points: number;
}

export interface GradingScale {
  id: string;
  name: string;
  shortName: string;
  grades: GradePoint[];
  notes?: string;
}

// ─── Reusable scale templates ──────────────────────────────────────────────

const STANDARD_PLUS_MINUS: GradePoint[] = [
  { minPercent: 93, letter: 'A',  points: 4.0 },
  { minPercent: 90, letter: 'A-', points: 3.7 },
  { minPercent: 87, letter: 'B+', points: 3.3 },
  { minPercent: 83, letter: 'B',  points: 3.0 },
  { minPercent: 80, letter: 'B-', points: 2.7 },
  { minPercent: 77, letter: 'C+', points: 2.3 },
  { minPercent: 73, letter: 'C',  points: 2.0 },
  { minPercent: 70, letter: 'C-', points: 1.7 },
  { minPercent: 67, letter: 'D+', points: 1.3 },
  { minPercent: 63, letter: 'D',  points: 1.0 },
  { minPercent: 60, letter: 'D-', points: 0.7 },
  { minPercent: 0,  letter: 'F',  points: 0.0 },
];

const STANDARD_PLUS_MINUS_A_PLUS: GradePoint[] = [
  { minPercent: 97, letter: 'A+', points: 4.3 },
  { minPercent: 93, letter: 'A',  points: 4.0 },
  { minPercent: 90, letter: 'A-', points: 3.7 },
  { minPercent: 87, letter: 'B+', points: 3.3 },
  { minPercent: 83, letter: 'B',  points: 3.0 },
  { minPercent: 80, letter: 'B-', points: 2.7 },
  { minPercent: 77, letter: 'C+', points: 2.3 },
  { minPercent: 73, letter: 'C',  points: 2.0 },
  { minPercent: 70, letter: 'C-', points: 1.7 },
  { minPercent: 67, letter: 'D+', points: 1.3 },
  { minPercent: 63, letter: 'D',  points: 1.0 },
  { minPercent: 60, letter: 'D-', points: 0.7 },
  { minPercent: 0,  letter: 'F',  points: 0.0 },
];

const NO_PLUS_MINUS: GradePoint[] = [
  { minPercent: 90, letter: 'A', points: 4.0 },
  { minPercent: 80, letter: 'B', points: 3.0 },
  { minPercent: 70, letter: 'C', points: 2.0 },
  { minPercent: 60, letter: 'D', points: 1.0 },
  { minPercent: 0,  letter: 'F', points: 0.0 },
];

// Wide-band +/- (5-point spreads): used by some large state schools
const WIDE_BAND_PLUS_MINUS: GradePoint[] = [
  { minPercent: 95, letter: 'A',  points: 4.0 },
  { minPercent: 90, letter: 'A-', points: 3.7 },
  { minPercent: 85, letter: 'B+', points: 3.3 },
  { minPercent: 80, letter: 'B',  points: 3.0 },
  { minPercent: 75, letter: 'B-', points: 2.7 },
  { minPercent: 70, letter: 'C+', points: 2.3 },
  { minPercent: 65, letter: 'C',  points: 2.0 },
  { minPercent: 60, letter: 'C-', points: 1.7 },
  { minPercent: 55, letter: 'D+', points: 1.3 },
  { minPercent: 50, letter: 'D',  points: 1.0 },
  { minPercent: 0,  letter: 'F',  points: 0.0 },
];

// ─── Ivy League specific scales ────────────────────────────────────────────

// Harvard — uses "E" (not "F") for failure. Standard +/- cutoffs otherwise.
const HARVARD_SCALE: GradePoint[] = [
  { minPercent: 93, letter: 'A',  points: 4.0 },
  { minPercent: 90, letter: 'A-', points: 3.7 },
  { minPercent: 87, letter: 'B+', points: 3.3 },
  { minPercent: 83, letter: 'B',  points: 3.0 },
  { minPercent: 80, letter: 'B-', points: 2.7 },
  { minPercent: 77, letter: 'C+', points: 2.3 },
  { minPercent: 73, letter: 'C',  points: 2.0 },
  { minPercent: 70, letter: 'C-', points: 1.7 },
  { minPercent: 67, letter: 'D+', points: 1.3 },
  { minPercent: 63, letter: 'D',  points: 1.0 },
  { minPercent: 60, letter: 'D-', points: 0.7 },
  { minPercent: 0,  letter: 'E',  points: 0.0 }, // Harvard calls failure "E"
];

// Princeton — has A+ (=4.0, no boost), no D+ or D- (just D then F)
const PRINCETON_SCALE: GradePoint[] = [
  { minPercent: 97, letter: 'A+', points: 4.0 },
  { minPercent: 93, letter: 'A',  points: 4.0 },
  { minPercent: 90, letter: 'A-', points: 3.7 },
  { minPercent: 87, letter: 'B+', points: 3.3 },
  { minPercent: 83, letter: 'B',  points: 3.0 },
  { minPercent: 80, letter: 'B-', points: 2.7 },
  { minPercent: 77, letter: 'C+', points: 2.3 },
  { minPercent: 73, letter: 'C',  points: 2.0 },
  { minPercent: 70, letter: 'C-', points: 1.7 },
  { minPercent: 60, letter: 'D',  points: 1.0 }, // No D+ or D-
  { minPercent: 0,  letter: 'F',  points: 0.0 },
];

// Brown — no D grades at all; below C- earns NC (No Credit, = 0.0 GPA)
const BROWN_SCALE: GradePoint[] = [
  { minPercent: 93, letter: 'A',  points: 4.0 },
  { minPercent: 90, letter: 'A-', points: 3.7 },
  { minPercent: 87, letter: 'B+', points: 3.3 },
  { minPercent: 83, letter: 'B',  points: 3.0 },
  { minPercent: 80, letter: 'B-', points: 2.7 },
  { minPercent: 77, letter: 'C+', points: 2.3 },
  { minPercent: 73, letter: 'C',  points: 2.0 },
  { minPercent: 68, letter: 'C-', points: 1.7 },
  { minPercent: 0,  letter: 'NC', points: 0.0 }, // No D grades — NC = No Credit
];

// Yale — A+ exists but still equals 4.0 (no GPA boost), standard cutoffs
const YALE_SCALE: GradePoint[] = [
  { minPercent: 97, letter: 'A+', points: 4.0 },
  { minPercent: 93, letter: 'A',  points: 4.0 },
  { minPercent: 90, letter: 'A-', points: 3.7 },
  { minPercent: 87, letter: 'B+', points: 3.3 },
  { minPercent: 83, letter: 'B',  points: 3.0 },
  { minPercent: 80, letter: 'B-', points: 2.7 },
  { minPercent: 77, letter: 'C+', points: 2.3 },
  { minPercent: 73, letter: 'C',  points: 2.0 },
  { minPercent: 70, letter: 'C-', points: 1.7 },
  { minPercent: 67, letter: 'D+', points: 1.3 },
  { minPercent: 60, letter: 'D',  points: 1.0 },
  { minPercent: 0,  letter: 'F',  points: 0.0 },
];

// ─── School catalog ────────────────────────────────────────────────────────

export const GRADING_SCALES: GradingScale[] = [
  // ── Generic options (always at top) ──────────────────────────────────────
  {
    id: 'generic-plus-minus',
    name: 'Standard Plus/Minus Scale',
    shortName: 'Standard +/−',
    grades: STANDARD_PLUS_MINUS,
    notes: 'Most common US university scale. A=93+, A-=90-92, B+=87-89 …',
  },
  {
    id: 'generic-no-plus-minus',
    name: 'Simple Scale (No Plus/Minus)',
    shortName: 'No +/−',
    grades: NO_PLUS_MINUS,
    notes: 'Round grades only. A=90+, B=80-89, C=70-79, D=60-69.',
  },
  {
    id: 'generic-a-plus',
    name: 'Plus/Minus with A+ = 4.3',
    shortName: '+/− with A+',
    grades: STANDARD_PLUS_MINUS_A_PLUS,
    notes: 'Same as standard but A+ (97+) earns 4.3 GPA points.',
  },

  // ── Ivy League ───────────────────────────────────────────────────────────
  {
    id: 'harvard',
    name: 'Harvard University',
    shortName: 'Harvard',
    grades: HARVARD_SCALE,
    notes: 'Harvard calls failing "E" (not F). Standard +/− cutoffs otherwise.',
  },
  {
    id: 'yale',
    name: 'Yale University',
    shortName: 'Yale',
    grades: YALE_SCALE,
    notes: 'A+ awarded but still counts as 4.0 (no GPA boost). No D- grade.',
  },
  {
    id: 'princeton',
    name: 'Princeton University',
    shortName: 'Princeton',
    grades: PRINCETON_SCALE,
    notes: 'A+ = 4.0 (no boost). No D+ or D− — jumps directly from C− to D to F.',
  },
  {
    id: 'columbia',
    name: 'Columbia University',
    shortName: 'Columbia',
    grades: STANDARD_PLUS_MINUS,
    notes: 'Standard 4.0 plus/minus scale. A=93+, A-=90-92.',
  },
  {
    id: 'upenn',
    name: 'University of Pennsylvania (UPenn)',
    shortName: 'UPenn',
    grades: STANDARD_PLUS_MINUS,
    notes: 'Standard 4.0 plus/minus scale. A=93+, A-=90-92.',
  },
  {
    id: 'dartmouth',
    name: 'Dartmouth College',
    shortName: 'Dartmouth',
    grades: STANDARD_PLUS_MINUS,
    notes: 'Standard 4.0 plus/minus scale. A=93+, A-=90-92.',
  },
  {
    id: 'cornell',
    name: 'Cornell University',
    shortName: 'Cornell',
    grades: STANDARD_PLUS_MINUS,
    notes: 'Standard 4.0 plus/minus scale. A=93+, A-=90-92.',
  },
  {
    id: 'brown',
    name: 'Brown University',
    shortName: 'Brown',
    grades: BROWN_SCALE,
    notes: 'Brown has NO D grades. Below C− earns NC (No Credit) = 0.0 GPA.',
  },

  // ── Texas ────────────────────────────────────────────────────────────────
  {
    id: 'smu',
    name: 'Southern Methodist University (SMU)',
    shortName: 'SMU',
    grades: STANDARD_PLUS_MINUS,
    notes: 'Standard plus/minus scale. A=93+, A-=90-92, B+=87-89.',
  },
  {
    id: 'ut-austin',
    name: 'University of Texas at Austin (UT)',
    shortName: 'UT Austin',
    grades: STANDARD_PLUS_MINUS,
    notes: 'Standard plus/minus scale. A=93+, A-=90-92.',
  },
  {
    id: 'texas-am',
    name: 'Texas A&M University',
    shortName: 'Texas A&M',
    grades: NO_PLUS_MINUS,
    notes: 'Texas A&M uses a no-plus/minus scale. A=90-100, B=80-89, C=70-79, D=60-69.',
  },
  {
    id: 'tcu',
    name: 'Texas Christian University (TCU)',
    shortName: 'TCU',
    grades: STANDARD_PLUS_MINUS,
    notes: 'Standard plus/minus scale. A=93+, A-=90-92.',
  },
  {
    id: 'baylor',
    name: 'Baylor University',
    shortName: 'Baylor',
    grades: STANDARD_PLUS_MINUS,
    notes: 'Standard plus/minus scale. A=93+, A-=90-92.',
  },
  {
    id: 'rice',
    name: 'Rice University',
    shortName: 'Rice',
    grades: STANDARD_PLUS_MINUS,
    notes: 'Standard plus/minus scale. A=93+, A-=90-92.',
  },
  {
    id: 'utd',
    name: 'University of Texas at Dallas (UTD)',
    shortName: 'UT Dallas',
    grades: STANDARD_PLUS_MINUS,
  },
  {
    id: 'texas-tech',
    name: 'Texas Tech University',
    shortName: 'Texas Tech',
    grades: STANDARD_PLUS_MINUS,
  },
  {
    id: 'uh',
    name: 'University of Houston',
    shortName: 'U of Houston',
    grades: STANDARD_PLUS_MINUS,
  },

  // ── Top Research / Tech ──────────────────────────────────────────────────
  {
    id: 'mit',
    name: 'Massachusetts Institute of Technology (MIT)',
    shortName: 'MIT',
    grades: STANDARD_PLUS_MINUS,
    notes: 'Standard plus/minus scale. First-semester freshmen grades are P/NR only.',
  },
  {
    id: 'stanford',
    name: 'Stanford University',
    shortName: 'Stanford',
    grades: STANDARD_PLUS_MINUS,
    notes: 'Standard plus/minus scale. A+ possible but still equals 4.0.',
  },
  {
    id: 'chicago',
    name: 'University of Chicago',
    shortName: 'UChicago',
    grades: STANDARD_PLUS_MINUS,
    notes: 'Standard plus/minus scale. A=93+, A-=90-92.',
  },
  {
    id: 'caltech',
    name: 'California Institute of Technology (Caltech)',
    shortName: 'Caltech',
    grades: NO_PLUS_MINUS,
    notes: 'No plus/minus. Freshmen take all classes pass/fail first term.',
  },
  {
    id: 'gatech',
    name: 'Georgia Institute of Technology (Georgia Tech)',
    shortName: 'Georgia Tech',
    grades: [
      { minPercent: 90, letter: 'A', points: 4.0 },
      { minPercent: 80, letter: 'B', points: 3.0 },
      { minPercent: 70, letter: 'C', points: 2.0 },
      { minPercent: 60, letter: 'D', points: 1.0 },
      { minPercent: 0,  letter: 'F', points: 0.0 },
    ],
    notes: 'No plus/minus. A=90+, B=80+, C=70+, D=60+.',
  },
  {
    id: 'carnegie-mellon',
    name: 'Carnegie Mellon University (CMU)',
    shortName: 'CMU',
    grades: STANDARD_PLUS_MINUS,
    notes: 'Standard plus/minus scale.',
  },
  {
    id: 'johns-hopkins',
    name: 'Johns Hopkins University (JHU)',
    shortName: 'Johns Hopkins',
    grades: STANDARD_PLUS_MINUS,
    notes: 'Standard plus/minus scale. A=93+, A-=90-92.',
  },

  // ── Southeast ───────────────────────────────────────────────────────────
  {
    id: 'duke',
    name: 'Duke University',
    shortName: 'Duke',
    grades: STANDARD_PLUS_MINUS,
    notes: 'Standard plus/minus scale.',
  },
  {
    id: 'vanderbilt',
    name: 'Vanderbilt University',
    shortName: 'Vanderbilt',
    grades: STANDARD_PLUS_MINUS,
  },
  {
    id: 'emory',
    name: 'Emory University',
    shortName: 'Emory',
    grades: STANDARD_PLUS_MINUS,
  },
  {
    id: 'unc',
    name: 'University of North Carolina (UNC)',
    shortName: 'UNC',
    grades: STANDARD_PLUS_MINUS,
  },
  {
    id: 'florida',
    name: 'University of Florida',
    shortName: 'U of Florida',
    grades: STANDARD_PLUS_MINUS,
  },
  {
    id: 'florida-state',
    name: 'Florida State University',
    shortName: 'Florida State',
    grades: STANDARD_PLUS_MINUS,
  },
  {
    id: 'georgia',
    name: 'University of Georgia',
    shortName: 'UGA',
    grades: STANDARD_PLUS_MINUS,
  },
  {
    id: 'alabama',
    name: 'University of Alabama',
    shortName: 'Alabama',
    grades: STANDARD_PLUS_MINUS,
  },
  {
    id: 'lsu',
    name: 'Louisiana State University (LSU)',
    shortName: 'LSU',
    grades: STANDARD_PLUS_MINUS,
  },
  {
    id: 'tulane',
    name: 'Tulane University',
    shortName: 'Tulane',
    grades: STANDARD_PLUS_MINUS,
  },

  // ── Midwest ──────────────────────────────────────────────────────────────
  {
    id: 'michigan',
    name: 'University of Michigan',
    shortName: 'U of Michigan',
    grades: STANDARD_PLUS_MINUS,
  },
  {
    id: 'northwestern',
    name: 'Northwestern University',
    shortName: 'Northwestern',
    grades: STANDARD_PLUS_MINUS,
  },
  {
    id: 'notre-dame',
    name: 'University of Notre Dame',
    shortName: 'Notre Dame',
    grades: STANDARD_PLUS_MINUS,
  },
  {
    id: 'ohio-state',
    name: 'Ohio State University',
    shortName: 'Ohio State',
    grades: STANDARD_PLUS_MINUS,
  },
  {
    id: 'purdue',
    name: 'Purdue University',
    shortName: 'Purdue',
    grades: STANDARD_PLUS_MINUS,
  },
  {
    id: 'illinois',
    name: 'University of Illinois Urbana-Champaign (UIUC)',
    shortName: 'UIUC',
    grades: STANDARD_PLUS_MINUS,
  },
  {
    id: 'wisconsin',
    name: 'University of Wisconsin–Madison',
    shortName: 'UW Madison',
    grades: STANDARD_PLUS_MINUS,
  },
  {
    id: 'minnesota',
    name: 'University of Minnesota',
    shortName: 'U of Minnesota',
    grades: STANDARD_PLUS_MINUS,
  },
  {
    id: 'washington-st-louis',
    name: 'Washington University in St. Louis (WashU)',
    shortName: 'WashU',
    grades: STANDARD_PLUS_MINUS,
  },

  // ── Northeast ────────────────────────────────────────────────────────────
  {
    id: 'nyu',
    name: 'New York University (NYU)',
    shortName: 'NYU',
    grades: STANDARD_PLUS_MINUS,
  },
  {
    id: 'bu',
    name: 'Boston University (BU)',
    shortName: 'Boston Univ.',
    grades: STANDARD_PLUS_MINUS,
  },
  {
    id: 'northeastern',
    name: 'Northeastern University',
    shortName: 'Northeastern',
    grades: STANDARD_PLUS_MINUS,
  },
  {
    id: 'tufts',
    name: 'Tufts University',
    shortName: 'Tufts',
    grades: STANDARD_PLUS_MINUS,
  },
  {
    id: 'georgetown',
    name: 'Georgetown University',
    shortName: 'Georgetown',
    grades: STANDARD_PLUS_MINUS,
  },
  {
    id: 'george-washington',
    name: 'George Washington University (GWU)',
    shortName: 'GWU',
    grades: STANDARD_PLUS_MINUS,
  },
  {
    id: 'american',
    name: 'American University',
    shortName: 'American Univ.',
    grades: STANDARD_PLUS_MINUS,
  },

  // ── West Coast ───────────────────────────────────────────────────────────
  {
    id: 'ucla',
    name: 'University of California, Los Angeles (UCLA)',
    shortName: 'UCLA',
    grades: STANDARD_PLUS_MINUS,
  },
  {
    id: 'ucsd',
    name: 'University of California, San Diego (UCSD)',
    shortName: 'UC San Diego',
    grades: STANDARD_PLUS_MINUS,
  },
  {
    id: 'ucb',
    name: 'University of California, Berkeley (UC Berkeley)',
    shortName: 'UC Berkeley',
    grades: STANDARD_PLUS_MINUS,
  },
  {
    id: 'usc',
    name: 'University of Southern California (USC)',
    shortName: 'USC',
    grades: STANDARD_PLUS_MINUS,
  },
  {
    id: 'uw',
    name: 'University of Washington',
    shortName: 'U of Washington',
    grades: STANDARD_PLUS_MINUS,
  },
  {
    id: 'oregon',
    name: 'University of Oregon',
    shortName: 'U of Oregon',
    grades: STANDARD_PLUS_MINUS,
  },
  {
    id: 'byu',
    name: 'Brigham Young University (BYU)',
    shortName: 'BYU',
    grades: STANDARD_PLUS_MINUS,
  },
  {
    id: 'wide-band',
    name: 'Wide-Band Scale (95/90/85/80/75 …)',
    shortName: 'Wide-Band +/−',
    grades: WIDE_BAND_PLUS_MINUS,
    notes: 'Used by some schools with 5-point bands: A=95+, A-=90-94, B+=85-89 …',
  },
];

// ─── GPA calculation helpers ───────────────────────────────────────────────

export function getDefaultScale(): GradingScale {
  return GRADING_SCALES.find(s => s.id === 'generic-plus-minus')!;
}

export function getScaleById(id: string): GradingScale {
  return GRADING_SCALES.find(s => s.id === id) ?? getDefaultScale();
}

/** Convert a percentage score to GPA quality points using the given scale */
export function scoreToGpaPoints(percent: number, scale: GradingScale): number {
  for (const grade of scale.grades) {
    if (percent >= grade.minPercent) return grade.points;
  }
  return 0;
}

/** Convert a percentage score to a letter grade using the given scale */
export function scoreToLetter(percent: number, scale: GradingScale): string {
  for (const grade of scale.grades) {
    if (percent >= grade.minPercent) return grade.letter;
  }
  return scale.grades[scale.grades.length - 1]?.letter ?? 'F';
}
