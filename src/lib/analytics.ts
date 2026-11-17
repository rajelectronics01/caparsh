import { addDays, diffDays, monthKey, rangeDays, weekStart } from './dates'
import type { Activity, Chapter, Data, PlanItem, Session, Subject } from './types'
import { PLAN_KINDS } from './types'

export type Cat = 'lecture' | 'self' | 'practice' | 'revision'
export const CATS: { id: Cat; label: string }[] = [
  { id: 'lecture', label: 'Lectures' },
  { id: 'self', label: 'Self-study' },
  { id: 'practice', label: 'Practice' },
  { id: 'revision', label: 'Revision' },
]
/** Every activity maps to exactly one category, so category totals always sum to the grand total. */
export const catOf = (a: Activity): Cat => (a === 'lecture' ? 'lecture' : a === 'self' ? 'self' : a === 'revision' ? 'revision' : 'practice')

export type ChapterStatus = 'Not Started' | 'In Progress' | 'Lectures Completed' | 'Practice Pending' | 'Revision Pending' | 'Completed'

export interface ChapterStats {
  chapter: Chapter
  totalLectures: number // from the lecture list when there is one
  hasList: boolean
  /** Minutes still to watch, exact when the chapter has a lecture list (null otherwise). */
  remainingMin: number | null
  listedMin: number // total length of the listed lectures
  listedKnown: number // listed lectures whose length is known
  lecturesDone: number
  lecturesLeft: number
  lecturePct: number
  questions: number // attempted (practised)
  correct: number // answered correctly, where recorded
  graded: number // attempted questions that also have a correct count
  practicePct: number
  revisionsDone: number
  lecDone: boolean
  practiceDone: boolean
  revDone: boolean
  status: ChapterStatus
  progress: number // 0..100
  /** True when the chapter counts as finished under the current focus. */
  done: boolean
  minutes: number
}

interface ChAgg {
  lec: number
  q: number
  correct: number
  graded: number
  min: number
  touched: boolean
}

function aggregate(data: Data) {
  const m = new Map<string, ChAgg>()
  const get = (id: string) => {
    let a = m.get(id)
    if (!a) m.set(id, (a = { lec: 0, q: 0, correct: 0, graded: 0, min: 0, touched: false }))
    return a
  }
  for (const s of data.sessions) {
    if (!s.chapterId) continue
    const a = get(s.chapterId)
    a.touched = true
    a.min += s.durationMin
    a.lec += s.lecturesCompleted ?? 0
    a.q += s.qAttempted ?? 0
    if (s.qAttempted && s.qCorrect != null) {
      a.graded += s.qAttempted
      a.correct += s.qCorrect
    }
  }
  for (const t of data.tests) {
    if (!t.chapterId) continue
    const a = get(t.chapterId)
    a.touched = true
    a.q += t.attempted
    a.graded += t.attempted
    a.correct += t.correct
  }
  return m
}

export function chapterStats(data: Data): ChapterStats[] {
  const agg = aggregate(data)
  const req = Math.min(3, Math.max(1, data.settings.requiredRevisions || 1))
  const lecturesOnly = (data.settings.focus ?? 'lectures') === 'lectures'
  const subjectAvg = new Map(data.subjects.map((s) => [s.id, s.avgLectureMin]))
  return data.chapters.map((ch) => {
    const a = agg.get(ch.id)
    const list = ch.lectures?.length ? ch.lectures : null
    const avgMin = subjectAvg.get(ch.subjectId) ?? 120
    let totalLectures = ch.totalLectures
    let lecturesDone: number
    let lecturePct: number
    let remainingMin: number | null = null
    if (list) {
      // A faculty lecture list is the source of truth: ticked lectures count, partly watched ones count in part.
      totalLectures = list.length
      lecturesDone = list.filter((l) => l.done).length
      lecturePct = list.reduce((x, l) => x + (l.done ? 1 : Math.min(99, l.pct ?? 0) / 100), 0) / list.length
      remainingMin = list.reduce((x, l) => x + (l.done ? 0 : (l.minutes > 0 ? l.minutes : avgMin) * (1 - Math.min(99, l.pct ?? 0) / 100)), 0)
    } else {
      const marks = ch.lectureMarks.reduce((s, x) => s + x.n, 0)
      lecturesDone = Math.max(0, marks + (a?.lec ?? 0))
      if (totalLectures > 0) lecturesDone = Math.min(lecturesDone, totalLectures)
      lecturePct = totalLectures > 0 ? lecturesDone / totalLectures : 0
    }
    const questions = (a?.q ?? 0) + (ch.questionsManual || 0)
    const qPart = ch.questionTarget > 0 ? Math.min(1, questions / ch.questionTarget) : null
    const practicePct = qPart == null ? (ch.rtpDone ? 1 : 0) : 0.5 * qPart + 0.5 * (ch.rtpDone ? 1 : 0)
    const revisionsDone = ch.revisions.filter((r) => r.done).length
    const lecDone = totalLectures > 0 && lecturesDone >= totalLectures
    const practiceDone = practicePct >= 1
    const revDone = revisionsDone >= req
    const started = lecturesDone > 0 || !!list?.some((l) => (l.pct ?? 0) > 0) || questions > 0 || revisionsDone > 0 || ch.rtpDone || !!a?.touched
    // Lectures alone never complete a chapter: all three gates are required.
    let status: ChapterStatus
    if (!started) status = 'Not Started'
    else if (lecturesOnly) status = lecDone ? 'Lectures Completed' : 'In Progress'
    else if (lecDone && practiceDone && revDone) status = 'Completed'
    else if (!lecDone) status = 'In Progress'
    else if (questions === 0 && !ch.rtpDone && revisionsDone === 0) status = 'Lectures Completed'
    else if (!practiceDone) status = 'Practice Pending'
    else status = 'Revision Pending'
    const progress = lecturesOnly ? 100 * lecturePct : 100 * (0.5 * lecturePct + 0.25 * practicePct + 0.25 * Math.min(1, revisionsDone / req))
    const done = lecturesOnly ? lecDone : status === 'Completed'
    return {
      chapter: ch,
      totalLectures,
      hasList: !!list,
      remainingMin,
      listedMin: list ? list.reduce((x, l) => x + l.minutes, 0) : 0,
      listedKnown: list ? list.filter((l) => l.minutes > 0).length : 0,
      lecturesDone,
      lecturesLeft: Math.max(0, totalLectures - lecturesDone),
      lecturePct: lecturePct * 100,
      questions,
      correct: a?.correct ?? 0,
      graded: a?.graded ?? 0,
      practicePct: practicePct * 100,
      revisionsDone,
      lecDone,
      practiceDone,
      revDone,
      status,
      progress,
      done,
      minutes: a?.min ?? 0,
    }
  })
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

export interface SubjectStats {
  subject: Subject
  chapters: ChapterStats[]
  completion: number
  completed: number
  inProgress: number
  notStarted: number
  totalLectures: number
  lecturesDone: number
  lecturesLeft: number
  avgLectureMin: number
  avgIsMeasured: boolean // true when the average comes from your log or the faculty list rather than an estimate
  listedLectures: number
  listedMinutes: number
  lectureMin: number
  remainingMin: number
  minutes: number
  revisionPct: number
  behind: number // lectures behind the pace needed for the target date
  expected: number
}

export function subjectStats(data: Data, cs: ChapterStats[], todayISO: string): SubjectStats[] {
  return [...data.subjects]
    .sort((a, b) => a.order - b.order)
    .map((subject) => {
      const chapters = cs.filter((c) => c.chapter.subjectId === subject.id).sort((a, b) => a.chapter.order - b.chapter.order)
      const sess = data.sessions.filter((s) => s.subjectId === subject.id)
      const lecSess = sess.filter((s) => s.activity === 'lecture')
      const counted = lecSess.filter((s) => (s.lecturesCompleted ?? 0) > 0)
      const countedLectures = sum(counted.map((s) => s.lecturesCompleted ?? 0))
      const avgIsMeasured = countedLectures > 0
      const listedCount = sum(chapters.filter((c) => c.hasList).map((c) => c.totalLectures))
      const listedMinutes = sum(chapters.map((c) => c.listedMin))
      const listedKnown = sum(chapters.map((c) => c.listedKnown))
      const fromList = listedKnown > 0
      const avgLectureMin = fromList ? listedMinutes / listedKnown : avgIsMeasured ? sum(counted.map((s) => s.durationMin)) / countedLectures : subject.avgLectureMin
      const totalLectures = sum(chapters.map((c) => c.totalLectures))
      const lecturesDone = sum(chapters.map((c) => c.lecturesDone))
      const lecturesLeft = sum(chapters.map((c) => c.lecturesLeft))
      let expected = 0
      if (subject.lectureTargetDate && totalLectures > 0) {
        const span = diffDays(data.settings.startDate, subject.lectureTargetDate)
        const elapsed = diffDays(data.settings.startDate, todayISO)
        const frac = span <= 0 ? 1 : Math.min(1, Math.max(0, elapsed / span))
        expected = Math.floor(totalLectures * frac)
      }
      return {
        subject,
        chapters,
        completion: mean(chapters.map((c) => c.progress)),
        completed: chapters.filter((c) => c.done).length,
        notStarted: chapters.filter((c) => c.status === 'Not Started').length,
        inProgress: chapters.filter((c) => !c.done && c.status !== 'Not Started').length,
        totalLectures,
        lecturesDone,
        lecturesLeft,
        avgLectureMin,
        avgIsMeasured: avgIsMeasured || fromList,
        listedLectures: listedCount,
        listedMinutes,
        lectureMin: sum(lecSess.map((s) => s.durationMin)),
        remainingMin: sum(chapters.map((c) => c.remainingMin ?? c.lecturesLeft * avgLectureMin)),
        minutes: sum(sess.map((s) => s.durationMin)),
        revisionPct: chapters.length ? (100 * sum(chapters.map((c) => c.revisionsDone))) / (3 * chapters.length) : 0,
        behind: Math.max(0, expected - lecturesDone),
        expected,
      }
    })
}

export interface Completion {
  overall: number
  g1: number
  g2: number
  papers: { paper: number; name: string; group: 1 | 2; completion: number }[]
  revision: number
}

/** A paper pools the chapters of its parts (DT + GST, FM + SM); groups and overall average papers equally. */
export function completion(ss: SubjectStats[]): Completion {
  const byPaper = new Map<number, SubjectStats[]>()
  for (const s of ss) byPaper.set(s.subject.paper, [...(byPaper.get(s.subject.paper) ?? []), s])
  const papers = [...byPaper.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([paper, list]) => ({
      paper,
      name: list[0].subject.paperName,
      group: list[0].subject.group,
      completion: mean(list.flatMap((s) => s.chapters.map((c) => c.progress))),
    }))
  const all = ss.flatMap((s) => s.chapters)
  return {
    overall: mean(papers.map((p) => p.completion)),
    g1: mean(papers.filter((p) => p.group === 1).map((p) => p.completion)),
    g2: mean(papers.filter((p) => p.group === 2).map((p) => p.completion)),
    papers,
    revision: all.length ? (100 * sum(all.map((c) => c.revisionsDone))) / (3 * all.length) : 0,
  }
}

export interface Totals {
  total: number
  lecture: number
  self: number
  practice: number
  revision: number
}
const zero = (): Totals => ({ total: 0, lecture: 0, self: 0, practice: 0, revision: 0 })
export function totals(sessions: Session[]): Totals {
  const t = zero()
  for (const s of sessions) {
    t.total += s.durationMin
    t[catOf(s.activity)] += s.durationMin
  }
  return t
}

export function dailyMap(sessions: Session[]) {
  const m = new Map<string, Totals>()
  for (const s of sessions) {
    let t = m.get(s.date)
    if (!t) m.set(s.date, (t = zero()))
    t.total += s.durationMin
    t[catOf(s.activity)] += s.durationMin
  }
  return m
}

/** Active days are days with more than zero logged minutes. */
export const activeDays = (sessions: Session[]) => [...dailyMap(sessions).values()].filter((t) => t.total > 0).length

export function streaks(sessions: Session[], todayISO: string) {
  const dm = dailyMap(sessions)
  const active = (d: string) => (dm.get(d)?.total ?? 0) > 0
  // The current streak survives until the end of today.
  let cur = 0
  let d = active(todayISO) ? todayISO : addDays(todayISO, -1)
  while (active(d)) {
    cur++
    d = addDays(d, -1)
  }
  let best = 0
  let run = 0
  let prev = ''
  for (const day of [...dm.keys()].filter(active).sort()) {
    run = prev && addDays(prev, 1) === day ? run + 1 : 1
    best = Math.max(best, run)
    prev = day
  }
  return { current: cur, best }
}

export function seriesDaily(sessions: Session[], from: string, to: string) {
  const dm = dailyMap(sessions)
  return rangeDays(from, to).map((date) => ({ date, ...(dm.get(date) ?? zero()) }))
}
export function seriesWeekly(sessions: Session[], weeks: number, todayISO: string) {
  const end = weekStart(todayISO)
  const out: ({ week: string } & Totals)[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = addDays(end, -7 * i)
    const we = addDays(ws, 6)
    out.push({ week: ws, ...totals(sessions.filter((s) => s.date >= ws && s.date <= we)) })
  }
  return out
}
export function seriesMonthly(sessions: Session[], startISO: string, todayISO: string) {
  const first = sessions.reduce((m, s) => (s.date < m ? s.date : m), startISO < todayISO ? startISO : todayISO)
  const out: ({ month: string } & Totals)[] = []
  let [y, m] = first.slice(0, 7).split('-').map(Number)
  const endKey = monthKey(todayISO)
  for (let guard = 0; guard < 60; guard++) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    out.push({ month: key, ...totals(sessions.filter((s) => monthKey(s.date) === key)) })
    if (key >= endKey) break
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return out
}

export function lecturesInRange(data: Data, from: string, to: string, subjectId?: string) {
  const inScope = data.chapters.filter((c) => !subjectId || c.subjectId === subjectId)
  const listed = new Set(inScope.filter((c) => c.lectures?.length).map((c) => c.id))
  let n = 0
  // Chapters with a lecture list count lectures by the date they were ticked; the rest by sessions and marks.
  for (const s of data.sessions) if (s.date >= from && s.date <= to && (!subjectId || s.subjectId === subjectId) && !(s.chapterId && listed.has(s.chapterId))) n += s.lecturesCompleted ?? 0
  for (const c of inScope) {
    if (listed.has(c.id)) n += c.lectures!.filter((l) => l.done && l.doneAt && l.doneAt >= from && l.doneAt <= to).length
    else for (const mk of c.lectureMarks) if (mk.date >= from && mk.date <= to) n += mk.n
  }
  return n
}

// ---------- Backlog ----------
export interface BacklogItem {
  key: string
  type: 'lecture' | 'practice' | 'revision' | 'plan'
  subjectId?: string
  chapterId?: string
  title: string
  detail: string
  minutes: number
  chunkMin: number
  count: number
  planId?: string
}

export function backlog(data: Data, cs: ChapterStats[], ss: SubjectStats[], todayISO: string): BacklogItem[] {
  const items: BacklogItem[] = []
  for (const s of ss) {
    if (s.behind > 0)
      items.push({
        key: `lec-${s.subject.id}`,
        type: 'lecture',
        subjectId: s.subject.id,
        title: `${s.subject.short}: ${s.behind} lecture${s.behind > 1 ? 's' : ''} behind pace`,
        detail: `Expected ${s.expected} by today for the ${s.subject.lectureTargetDate} target, ${s.lecturesDone} done`,
        minutes: s.behind * s.avgLectureMin,
        chunkMin: s.avgLectureMin,
        count: s.behind,
      })
  }
  const subj = new Map(data.subjects.map((s) => [s.id, s]))
  const full = (data.settings.focus ?? 'lectures') === 'full'
  for (const c of cs) {
    if (!full) break // practice and revision backlog only exist when those are tracked
    const sh = subj.get(c.chapter.subjectId)?.short ?? ''
    if (c.lecDone && !c.practiceDone) {
      const left = Math.max(0, c.chapter.questionTarget - c.questions)
      items.push({
        key: `prac-${c.chapter.id}`,
        type: 'practice',
        subjectId: c.chapter.subjectId,
        chapterId: c.chapter.id,
        title: `${sh}: practice pending for ${c.chapter.name}`,
        detail: [left > 0 ? `${left} questions short of target` : '', !c.chapter.rtpDone ? 'RTP/MTP/PYQ not done' : ''].filter(Boolean).join(' · '),
        minutes: Math.max(60, left * 4),
        chunkMin: 60,
        count: 1,
      })
    }
    const due = c.chapter.nextRevisionDate && c.chapter.nextRevisionDate <= todayISO && c.revisionsDone < 3
    if (due || (c.lecDone && c.revisionsDone === 0)) {
      items.push({
        key: `rev-${c.chapter.id}`,
        type: 'revision',
        subjectId: c.chapter.subjectId,
        chapterId: c.chapter.id,
        title: `${sh}: revision ${c.revisionsDone + 1} for ${c.chapter.name}`,
        detail: due ? `Was due ${c.chapter.nextRevisionDate}` : 'Lectures complete, never revised',
        minutes: 60,
        chunkMin: 60,
        count: 1,
      })
    }
  }
  for (const p of data.plans) {
    if (p.date < todayISO && !p.done && isStudyPlan(p))
      items.push({
        key: `plan-${p.id}`,
        type: 'plan',
        subjectId: p.subjectId,
        chapterId: p.chapterId,
        title: p.title,
        detail: `Planned for ${p.date}, not completed`,
        minutes: p.plannedMin || 60,
        chunkMin: Math.max(30, Math.min(p.plannedMin || 60, 120)),
        count: 1,
        planId: p.id,
      })
  }
  return items
}

export const isStudyPlan = (p: PlanItem) => !!PLAN_KINDS.find((k) => k.id === p.kind)?.study

/**
 * Spread backlog over future days without overloading any one day:
 * each day takes at most capMin extra minutes; anything that does not fit is returned as leftover.
 */
export function distribute(items: BacklogItem[], startISO: string, days: number, capMin: number, blocked: Set<string> = new Set()) {
  const dates = rangeDays(startISO, addDays(startISO, days - 1)).filter((d) => !blocked.has(d))
  const used = new Map(dates.map((d) => [d, 0]))
  const plans: Omit<PlanItem, 'id'>[] = []
  let leftoverMin = 0
  for (const it of items) {
    let remaining = it.minutes
    while (remaining > 0) {
      // A block longer than the daily allowance (a 3-hour lecture, say) is split across days rather than overloading one.
      const chunk = Math.min(remaining, it.chunkMin, capMin)
      const day = dates.find((d) => used.get(d)! + chunk <= capMin)
      if (!day) {
        leftoverMin += remaining
        break
      }
      used.set(day, used.get(day)! + chunk)
      const last = plans.find((p) => p.date === day && p.title === it.title)
      if (last) last.plannedMin += chunk
      else
        plans.push({
          date: day,
          kind: it.type === 'plan' ? 'self' : it.type,
          subjectId: it.subjectId,
          chapterId: it.chapterId,
          title: it.title,
          plannedMin: chunk,
          done: false,
          fromBacklog: true,
        })
      remaining -= chunk
    }
  }
  return { plans, leftoverMin }
}

// ---------- Reviews ----------
export function periodReview(data: Data, from: string, to: string) {
  const sessions = data.sessions.filter((s) => s.date >= from && s.date <= to)
  const t = totals(sessions)
  const tests = data.tests.filter((x) => x.date >= from && x.date <= to)
  const plans = data.plans.filter((p) => p.date >= from && p.date <= to && isStudyPlan(p))
  const missed = plans.filter((p) => !p.done)
  const bySubject = data.subjects
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((s) => ({
      subject: s,
      minutes: sum(sessions.filter((x) => x.subjectId === s.id).map((x) => x.durationMin)),
      lectures: lecturesInRange(data, from, to, s.id),
      targetMin: (data.settings.weeklyTargets[s.id] ?? 0) * 60,
    }))
  return {
    totals: t,
    activeDays: activeDays(sessions),
    days: diffDays(from, to) + 1,
    chaptersCompleted: data.chapters.filter((c) => c.completedAt && c.completedAt >= from && c.completedAt <= to),
    lectures: lecturesInRange(data, from, to),
    plannedMin: sum(plans.map((p) => p.plannedMin)),
    missedCount: missed.length,
    missedMin: sum(missed.map((p) => p.plannedMin)),
    bySubject,
    tests,
    avgScore: tests.filter((x) => x.totalMarks > 0).length ? mean(tests.filter((x) => x.totalMarks > 0).map((x) => (100 * x.marks) / x.totalMarks)) : null,
    qAttempted: sum(sessions.map((s) => s.qAttempted ?? 0)) + sum(tests.map((x) => x.attempted)),
    qCorrect: sum(sessions.map((s) => s.qCorrect ?? 0)) + sum(tests.map((x) => x.correct)),
  }
}

/** Latest snapshot on or before a date (used for "syllabus completion change"). */
export function snapshotAt(data: Data, iso: string) {
  let best = null as Data['snapshots'][number] | null
  for (const s of data.snapshots) if (s.id <= iso && (!best || s.id > best.id)) best = s
  return best
}

// ---------- Performance ----------
export function accuracyBySubject(data: Data) {
  return data.subjects
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((s) => {
      const sess = data.sessions.filter((x) => x.subjectId === s.id)
      const tests = data.tests.filter((x) => x.subjectId === s.id)
      const attempted = sum(sess.map((x) => x.qAttempted ?? 0)) + sum(tests.map((x) => x.attempted))
      const graded = sum(sess.filter((x) => x.qCorrect != null).map((x) => x.qAttempted ?? 0)) + sum(tests.map((x) => x.attempted))
      const correct = sum(sess.map((x) => x.qCorrect ?? 0)) + sum(tests.map((x) => x.correct))
      const scored = tests.filter((x) => x.totalMarks > 0)
      return {
        subject: s,
        attempted,
        graded,
        correct,
        accuracy: graded > 0 ? (100 * correct) / graded : null,
        tests: tests.length,
        avgScore: scored.length ? mean(scored.map((x) => (100 * x.marks) / x.totalMarks)) : null,
      }
    })
}

export type Strength = 'weak' | 'needs practice' | 'strong'
export function chapterStrength(cs: ChapterStats[], minGraded = 5) {
  return cs
    .filter((c) => c.graded >= minGraded)
    .map((c) => {
      const accuracy = (100 * c.correct) / c.graded
      const strength: Strength = accuracy < 50 ? 'weak' : accuracy < 70 ? 'needs practice' : 'strong'
      return { ...c, accuracy, strength }
    })
    .sort((a, b) => a.accuracy - b.accuracy)
}

// ---------- One-call summary (dashboard + friend comparison) ----------
export function summarize(data: Data, todayISO: string) {
  const cs = chapterStats(data)
  const ss = subjectStats(data, cs, todayISO)
  const comp = completion(ss)
  const t = totals(data.sessions)
  const active = activeDays(data.sessions)
  const bl = backlog(data, cs, ss, todayISO)
  const last7 = totals(data.sessions.filter((s) => s.date > addDays(todayISO, -7) && s.date <= todayISO))
  const last30 = totals(data.sessions.filter((s) => s.date > addDays(todayISO, -30) && s.date <= todayISO))
  return {
    cs,
    ss,
    comp,
    totals: t,
    active,
    avgPerActive: active ? t.total / active : 0,
    completed: cs.filter((c) => c.done).length,
    inProgress: cs.filter((c) => !c.done && c.status !== 'Not Started').length,
    pending: cs.filter((c) => c.status === 'Not Started').length,
    daysLeft: diffDays(todayISO, data.settings.examDate),
    streak: streaks(data.sessions, todayISO),
    backlog: bl,
    backlogMin: sum(bl.map((b) => b.minutes)),
    lecturesBehind: sum(ss.map((s) => s.behind)),
    lecturesTotalDone: sum(ss.map((x) => x.lecturesDone)),
    lecturesLeft: sum(ss.map((s) => s.lecturesLeft)),
    lecturesRemainingMin: sum(ss.map((s) => s.remainingMin)),
    last7,
    last30,
  }
}
export type Summary = ReturnType<typeof summarize>

/** Sessions on the same date whose clock times overlap the candidate (guards against double-counting). */
export function overlapping(sessions: Session[], cand: Pick<Session, 'id' | 'date' | 'start' | 'end'>) {
  if (!cand.start || !cand.end) return []
  const span = (s: { start?: string; end?: string }) => {
    const [h1, m1] = s.start!.split(':').map(Number)
    const [h2, m2] = s.end!.split(':').map(Number)
    const a = h1 * 60 + m1
    let b = h2 * 60 + m2
    if (b <= a) b += 1440
    return [a, b]
  }
  const [a, b] = span(cand)
  return sessions.filter((s) => {
    if (s.id === cand.id || s.date !== cand.date || !s.start || !s.end) return false
    const [c, d] = span(s)
    return a < d && c < b
  })
}

// ---------- Guidance ----------
export interface Suggestion {
  key: string
  title: string
  why: string
  subjectId?: string
  chapterId?: string
  activity: Activity
  minutes: number
  planId?: string
}

/** Up to `n` concrete things to do next: today's plan first, then backlog, then the next unfinished chapter of the most neglected subject. */
export function nextUp(data: Data, s: Summary, todayISO: string, n = 3): Suggestion[] {
  const out: Suggestion[] = []
  const act = (k: string): Activity => (k === 'lecture' || k === 'practice' || k === 'revision' ? k : 'self')
  for (const p of data.plans.filter((x) => x.date === todayISO && !x.done && isStudyPlan(x)).sort((a, b) => (a.start ?? '99').localeCompare(b.start ?? '99')))
    out.push({ key: `plan-${p.id}`, title: p.title, why: p.start ? `Planned for ${p.start} today` : 'Planned for today', subjectId: p.subjectId, chapterId: p.chapterId, activity: act(p.kind), minutes: p.plannedMin, planId: p.id })
  for (const b of s.backlog.filter((x) => x.type !== 'plan'))
    out.push({ key: b.key, title: b.title, why: b.detail, subjectId: b.subjectId, chapterId: b.chapterId, activity: act(b.type), minutes: Math.min(b.minutes, b.chunkMin) })
  if (out.length < n) {
    const recent = (sid: string) => data.sessions.filter((x) => x.subjectId === sid && x.date > addDays(todayISO, -7)).reduce((a, x) => a + x.durationMin, 0)
    const cands = s.ss
      .map((x) => ({ x, next: x.chapters.find((c) => !c.done) }))
      .filter((c) => c.next)
      .sort((a, b) => recent(a.x.subject.id) - recent(b.x.subject.id) || a.x.subject.order - b.x.subject.order)
    for (const { x, next } of cands) {
      if (out.length >= n) break
      const c = next!
      const activity: Activity = !c.lecDone ? 'lecture' : !c.practiceDone ? 'practice' : 'revision'
      const nl = activity === 'lecture' ? c.chapter.lectures?.find((l) => !l.done) : undefined
      const rec = recent(x.subject.id)
      out.push({
        key: `next-${c.chapter.id}`,
        title: nl ? `${x.subject.short}: ${nl.title}` : `${x.subject.short}: ${c.chapter.name}`,
        why: nl ? `${c.chapter.name}${rec === 0 ? ' · not touched in 7 days' : ''}` : rec === 0 ? 'Not touched in the last 7 days' : `${fmtMin(rec)} in the last 7 days`,
        subjectId: x.subject.id,
        chapterId: c.chapter.id,
        activity,
        minutes: nl && nl.minutes > 0 ? Math.round(nl.minutes * (1 - Math.min(99, nl.pct ?? 0) / 100)) : activity === 'lecture' ? Math.round(x.avgLectureMin) : 60,
      })
    }
  }
  return out.slice(0, n)
}
const fmtMin = (m: number) => (m >= 60 ? `${Math.round((m / 60) * 10) / 10}h` : `${m}m`)

/** Where the current pace leads: lecture finish date at the 14-day rate, and the daily hours needed to finish lectures before the exam. */
export function forecast(data: Data, s: Summary, todayISO: string) {
  const window = 14
  const done14 = lecturesInRange(data, addDays(todayISO, -(window - 1)), todayISO)
  const perDay = done14 / window
  const left = s.lecturesLeft
  const finish = perDay > 0 && left > 0 ? addDays(todayISO, Math.ceil(left / perDay)) : null
  const daysLeft = Math.max(1, s.daysLeft)
  const hours14 = s.totals.total === 0 ? 0 : data.sessions.filter((x) => x.date > addDays(todayISO, -window) && x.date <= todayISO).reduce((a, x) => a + x.durationMin, 0) / window
  return {
    lecturesPerDay: perDay,
    lecturesLeft: left,
    finish,
    onTime: finish ? finish <= data.settings.examDate : null,
    neededLecturesPerDay: left / daysLeft,
    neededMinPerDay: s.lecturesRemainingMin / daysLeft,
    avgMinPerDay: hours14,
    hasCounts: s.ss.some((x) => x.totalLectures > 0),
  }
}

// ---------- Comparison helpers ----------
export interface SubjectMinutes {
  subject: Subject
  minutes: number
}
/** Minutes per subject for sessions dated within [from, to], in syllabus order. */
export function minutesBySubject(data: Data, from: string, to: string): SubjectMinutes[] {
  return [...data.subjects]
    .sort((a, b) => a.order - b.order)
    .map((subject) => ({ subject, minutes: data.sessions.filter((s) => s.subjectId === subject.id && s.date >= from && s.date <= to).reduce((a, s) => a + s.durationMin, 0) }))
}

/** One day's sessions in clock order; untimed sessions come last. */
export function sessionsOn(data: Data, date: string): Session[] {
  return data.sessions.filter((s) => s.date === date).sort((a, b) => (a.start ?? '99:99').localeCompare(b.start ?? '99:99'))
}
