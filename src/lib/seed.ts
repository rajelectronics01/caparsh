import type { Chapter, Rec, Settings, Subject } from './types'

// Chapter lists follow the ICAI new-scheme (2023) CA Intermediate syllabus.
// They are a starting point: every name, count and faculty is editable in the app.
const SUBJECTS: Omit<Subject, 'order'>[] = [
  { id: 'aa', name: 'Advanced Accounting', short: 'Adv Acc', paper: 1, paperName: 'Advanced Accounting', group: 1, faculty: 'Akash Kandoi Sir', slot: 1, avgLectureMin: 180 },
  { id: 'law', name: 'Corporate and Other Laws', short: 'Law', paper: 2, paperName: 'Corporate and Other Laws', group: 1, faculty: 'Shubham Singhal Sir', slot: 2, avgLectureMin: 150 },
  { id: 'dt', name: 'Income Tax (Direct Tax)', short: 'DT', paper: 3, paperName: 'Taxation', group: 1, faculty: 'BB Sir', slot: 3, avgLectureMin: 165 },
  { id: 'gst', name: 'GST (Indirect Tax)', short: 'GST', paper: 3, paperName: 'Taxation', group: 1, faculty: 'To be decided', slot: 4, avgLectureMin: 150 },
  { id: 'cma', name: 'Cost and Management Accounting', short: 'Costing', paper: 4, paperName: 'Cost and Management Accounting', group: 2, faculty: 'To be decided', slot: 5, avgLectureMin: 150 },
  { id: 'audit', name: 'Auditing and Ethics', short: 'Audit', paper: 5, paperName: 'Auditing and Ethics', group: 2, faculty: 'To be decided', slot: 6, avgLectureMin: 150 },
  { id: 'fm', name: 'Financial Management', short: 'FM', paper: 6, paperName: 'FM and SM', group: 2, faculty: 'To be decided', slot: 7, avgLectureMin: 150 },
  { id: 'sm', name: 'Strategic Management', short: 'SM', paper: 6, paperName: 'FM and SM', group: 2, faculty: 'To be decided', slot: 8, avgLectureMin: 120 },
]

const CHAPTERS: Record<string, string[]> = {
  aa: [
    'Introduction to Accounting Standards',
    'Framework for Preparation and Presentation of Financial Statements',
    'Applicability of Accounting Standards',
    'Presentation & Disclosures Based AS (AS 1, 3, 17, 18, 20, 24, 25)',
    'Assets Based AS (AS 2, 10, 13, 16, 19, 26, 28)',
    'Liabilities Based AS (AS 15, 29)',
    'AS Based on Items Impacting Financial Statements (AS 4, 5, 11, 22)',
    'Revenue Based AS (AS 7, 9)',
    'Other Accounting Standards (AS 12, 14)',
    'AS for Consolidated Financial Statements (AS 21, 23, 27)',
    'Financial Statements of Companies',
    'Buyback of Securities',
    'Amalgamation of Companies',
    'Accounting for Reconstruction of Companies',
    'Accounting for Branches including Foreign Branches',
  ],
  law: [
    'Preliminary',
    'Incorporation of Company and Matters Incidental Thereto',
    'Prospectus and Allotment of Securities',
    'Share Capital and Debentures',
    'Acceptance of Deposits by Companies',
    'Registration of Charges',
    'Management and Administration',
    'Declaration and Payment of Dividend',
    'Accounts of Companies',
    'Audit and Auditors',
    'Companies Incorporated Outside India',
    'The Limited Liability Partnership Act, 2008',
    'The General Clauses Act, 1897',
    'Interpretation of Statutes',
    'The Foreign Exchange Management Act, 1999',
  ],
  dt: [
    'Basic Concepts',
    'Residence and Scope of Total Income',
    'Salaries',
    'Income from House Property',
    'Profits and Gains of Business or Profession',
    'Capital Gains',
    'Income from Other Sources',
    "Income of Other Persons Included in Assessee's Total Income",
    'Aggregation of Income, Set-off and Carry Forward of Losses',
    'Deductions from Gross Total Income',
    'Advance Tax, TDS and TCS',
    'Provisions for Filing Return of Income and Self-Assessment',
    'Income Tax Liability – Computation and Optimisation',
  ],
  gst: [
    'GST in India – An Introduction',
    'Supply under GST',
    'Charge of GST',
    'Place of Supply',
    'Exemptions from GST',
    'Time of Supply',
    'Value of Supply',
    'Input Tax Credit',
    'Registration',
    'Tax Invoice; Credit and Debit Notes',
    'Accounts and Records',
    'E-Way Bill',
    'Payment of Tax',
    'Tax Deduction at Source and Collection of Tax at Source',
    'Returns',
  ],
  cma: [
    'Introduction to Cost and Management Accounting',
    'Material Cost',
    'Employee Cost and Direct Expenses',
    'Overheads – Absorption Costing Method',
    'Activity Based Costing',
    'Cost Sheet',
    'Cost Accounting Systems',
    'Unit & Batch Costing',
    'Job Costing',
    'Process & Operation Costing',
    'Joint Products and By Products',
    'Service Costing',
    'Standard Costing',
    'Marginal Costing',
    'Budgets and Budgetary Control',
  ],
  audit: [
    'Nature, Objective and Scope of Audit',
    'Audit Strategy, Audit Planning and Audit Programme',
    'Risk Assessment and Internal Control',
    'Audit Evidence',
    'Audit of Items of Financial Statements',
    'Audit Documentation',
    'Completion and Review',
    'Audit Report',
    'Special Features of Audit of Different Type of Entities',
    'Audit of Banks',
    'Ethics and Terms of Audit Engagements',
  ],
  fm: [
    'Scope and Objectives of Financial Management',
    'Types of Financing',
    'Financial Analysis and Planning – Ratio Analysis',
    'Cost of Capital',
    'Financing Decisions – Capital Structure',
    'Financing Decisions – Leverages',
    'Investment Decisions',
    'Dividend Decisions',
    'Management of Working Capital',
  ],
  sm: [
    'Introduction to Strategic Management',
    'Strategic Analysis: External Environment',
    'Strategic Analysis: Internal Environment',
    'Strategic Choices',
    'Strategy Implementation and Evaluation',
  ],
}

export const emptyRevisions = () => [{ done: false }, { done: false }, { done: false }]

export function defaultSettings(): Settings {
  return {
    id: 'settings',
    examDate: '2027-09-01',
    startDate: '2026-11-15',
    dailyTargetHours: { normal: 5, busy: 3, exam: 1, holiday: 8 },
    weeklyTargets: {},
    requiredRevisions: 1,
    collegeDays: [1, 2, 3, 4, 5, 6],
    collegeStart: '09:00',
    collegeEnd: '14:00',
    homeBy: '15:00',
    reminders: [{ id: 'r1', time: '16:00', label: 'Start today’s study block', enabled: true }],
    seeded: true,
  }
}

export function newChapter(subjectId: string, name: string, order: number, id?: string): Chapter {
  return {
    id: id ?? crypto.randomUUID(),
    subjectId,
    name,
    order,
    totalLectures: 0,
    lectureMarks: [],
    questionTarget: 0,
    questionsManual: 0,
    rtpDone: false,
    revisions: emptyRevisions(),
  }
}

/** Initial records for a brand-new account: structure only, zero progress. */
export function seedRecords(): Rec[] {
  const recs: Rec[] = [{ collection: 'settings', id: 'settings', data: defaultSettings() }]
  SUBJECTS.forEach((s, i) => {
    recs.push({ collection: 'subjects', id: s.id, data: { ...s, order: i } })
    CHAPTERS[s.id].forEach((name, j) => {
      const id = `${s.id}-${String(j + 1).padStart(2, '0')}`
      recs.push({ collection: 'chapters', id, data: newChapter(s.id, name, j, id) })
    })
  })
  return recs
}
