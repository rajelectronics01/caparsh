export type Activity = 'lecture' | 'self' | 'practice' | 'revision' | 'mock' | 'rtp'
export const ACTIVITIES: { id: Activity; label: string }[] = [
  { id: 'lecture', label: 'Recorded lecture' },
  { id: 'self', label: 'Self-study' },
  { id: 'practice', label: 'Question practice' },
  { id: 'revision', label: 'Revision' },
  { id: 'mock', label: 'Mock test' },
  { id: 'rtp', label: 'RTP/MTP/PYQ practice' },
]
/** Activities offered when logging new study. The rest stay readable on old entries. */
export const LOG_ACTIVITIES: { id: Activity; label: string }[] = ACTIVITIES.filter((a) => a.id === 'lecture' || a.id === 'self')
export const activityLabel = (a: string) => ACTIVITIES.find((x) => x.id === a)?.label ?? a

export interface Subject {
  id: string
  name: string
  short: string
  paper: number // 1..6
  paperName: string
  group: 1 | 2
  faculty: string
  slot: number // fixed colour slot 1..8
  order: number
  avgLectureMin: number // fallback estimate until real lecture sessions exist
  lectureTargetDate?: string // finish lectures by (drives the pace backlog)
}

export interface RevisionEntry {
  done: boolean
  date?: string
  durationMin?: number
  confidence?: number // 1..5
  weakAreas?: string
  topicsAgain?: string
}

export interface Chapter {
  id: string
  subjectId: string
  name: string
  order: number
  totalLectures: number
  lectureMarks: { date: string; n: number }[] // manual +/- marks, dated
  questionTarget: number
  questionsManual: number // questions practised outside logged sessions
  rtpDone: boolean
  revisions: RevisionEntry[] // always length 3
  nextRevisionDate?: string
  completedAt?: string // stamped automatically when fully prepared
}

export interface Session {
  id: string
  date: string // YYYY-MM-DD
  subjectId: string
  chapterId?: string
  activity: Activity
  start?: string // HH:MM
  end?: string
  durationMin: number
  topic?: string
  lecturesCompleted?: number
  qAttempted?: number
  qCorrect?: number
  notes?: string
  status: 'completed' | 'partial'
}

export type DayType = 'normal' | 'busy' | 'exam' | 'holiday'
export interface DayInfo {
  id: string // date
  college: boolean
  office: boolean
  semExam: boolean
  dayType: DayType
  note?: string
}

export type TestType = 'PYQ' | 'RTP' | 'MTP' | 'Mock' | 'Chapter Test'
export const TEST_TYPES: TestType[] = ['PYQ', 'RTP', 'MTP', 'Mock', 'Chapter Test']
export interface TestRecord {
  id: string
  date: string
  subjectId: string
  chapterId?: string
  type: TestType
  totalMarks: number
  marks: number
  attempted: number
  correct: number
  incorrect: number
  timeMin: number
  remarks?: string
}

export type PlanKind = 'lecture' | 'practice' | 'revision' | 'self' | 'college' | 'office' | 'exam' | 'other'
export const PLAN_KINDS: { id: PlanKind; label: string; study: boolean }[] = [
  { id: 'lecture', label: 'Recorded lecture', study: true },
  { id: 'practice', label: 'Question practice', study: true },
  { id: 'revision', label: 'Revision', study: true },
  { id: 'self', label: 'Self-study', study: true },
  { id: 'college', label: 'College', study: false },
  { id: 'office', label: 'Office', study: false },
  { id: 'exam', label: 'Semester exam', study: false },
  { id: 'other', label: 'Other', study: false },
]
export interface PlanItem {
  id: string
  date: string
  kind: PlanKind
  subjectId?: string
  chapterId?: string
  title: string
  start?: string
  end?: string
  plannedMin: number
  done: boolean
  fromBacklog?: boolean
}

export interface Reminder {
  id: string
  time: string // HH:MM local
  label: string
  enabled: boolean
}

export interface Settings {
  id: 'settings'
  examDate: string
  startDate: string
  dailyTargetHours: Record<DayType, number>
  weeklyTargets: Record<string, number> // subjectId -> hours per week
  requiredRevisions: number // revisions needed before a chapter counts as Completed (1..3), used in 'full' focus
  /** 'lectures': only lecture progress counts (revision, practice and tests are parked). 'full': the complete rules. */
  focus: 'lectures' | 'full'
  collegeDays: number[] // 0=Sun..6=Sat
  collegeStart: string
  collegeEnd: string
  homeBy: string
  reminders: Reminder[]
  seeded: boolean
}

export interface Snapshot {
  id: string // date
  overall: number
  g1: number
  g2: number
  revision: number
  subjects: Record<string, number>
}

export interface Data {
  settings: Settings
  subjects: Subject[]
  chapters: Chapter[]
  sessions: Session[]
  days: DayInfo[]
  tests: TestRecord[]
  plans: PlanItem[]
  snapshots: Snapshot[]
}

export type Collection = 'settings' | 'subjects' | 'chapters' | 'sessions' | 'days' | 'tests' | 'plans' | 'snapshots'
export const COLLECTIONS: Collection[] = ['settings', 'subjects', 'chapters', 'sessions', 'days', 'tests', 'plans', 'snapshots']

export interface Rec {
  collection: Collection
  id: string
  data: unknown
}

export interface Profile {
  id: string
  name: string
  code: string
  email?: string
}
