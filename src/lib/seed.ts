import { uid } from './dates'
import type { Chapter, Rec, Settings, Subject } from './types'

// Chapter titles follow ICAI's Board of Studies study material for the Intermediate course (New Scheme),
// as listed on icai.org in November 2026. Income-tax follows the edition applicable for May 2027,
// September 2027 and January 2028; its Chapter 3 (Heads of Income) is tracked as its five units.
// Every name, count and faculty stays editable in the app.
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
    'Presentation & Disclosures Based Accounting Standards',
    'Assets Based Accounting Standards',
    'Liabilities Based Accounting Standards',
    'Accounting Standards Based on Items Impacting Financial Statements',
    'Revenue Based Accounting Standards',
    'Other Accounting Standards',
    'Accounting Standards for Consolidated Financial Statement',
    'Financial Statements of Companies',
    'Buy back of Securities',
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
    'Residential Status and Scope of Total Income',
    'Heads of Income: Salaries',
    'Heads of Income: Income from House Property',
    'Heads of Income: Profits and Gains of Business or Profession',
    'Heads of Income: Capital Gains',
    'Heads of Income: Income from Other Sources',
    "Income of Other Persons Included in Assessee's Total Income",
    'Set-Off or Carry Forward and Set-off of Losses',
    'Deductions from Gross Total Income',
    'Tax Deduction or Collection at Source and Advance Tax',
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
    'Overheads (Absorption Costing Method)',
    'Activity Based Costing',
    'Cost Sheet',
    'Cost Accounting Systems',
    'Unit and Batch Costing',
    'Job Costing',
    'Process and Operation Costing',
    'Joint Products and By-Products',
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
    focus: 'lectures',
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
    id: id ?? uid(),
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
