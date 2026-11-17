import { describe, expect, it } from 'vitest'
import { dueReminders } from '../../supabase/functions/remind/due'
import { activeDays, backlog, chapterStats, completion, distribute, overlapping, periodReview, streaks, subjectStats, summarize, totals } from './analytics'
import { durationBetween, weekStart } from './dates'
import { seedRecords } from './seed'
import { assemble } from './store'
import type { Chapter, Data, Session } from './types'

const lectureMode = (): Data => assemble(seedRecords())
/** The complete rules (lectures, practice and revision), which are parked in the app for now. */
const base = (): Data => {
  const d = assemble(seedRecords())
  d.settings.focus = 'full'
  return d
}
const sess = (p: Partial<Session>): Session => ({ id: Math.random().toString(36), date: '2026-11-16', subjectId: 'aa', activity: 'lecture', durationMin: 60, status: 'completed', ...p })
const ch = (d: Data, id: string, patch: Partial<Chapter>) => {
  d.chapters = d.chapters.map((c) => (c.id === id ? { ...c, ...patch } : c))
}
const stat = (d: Data, id: string) => chapterStats(d).find((c) => c.chapter.id === id)!

describe('seed', () => {
  it('has 8 units across 6 papers and no progress', () => {
    const d = base()
    expect(d.subjects).toHaveLength(8)
    expect(new Set(d.subjects.map((s) => s.paper)).size).toBe(6)
    const s = summarize(d, '2026-11-15')
    expect(s.comp.overall).toBe(0)
    expect(s.totals.total).toBe(0)
    expect(s.active).toBe(0)
    expect(s.backlog).toHaveLength(0)
    expect(s.completed).toBe(0)
    expect(s.pending).toBe(d.chapters.length)
  })
})

describe('durations', () => {
  it('computes minutes and handles midnight', () => {
    expect(durationBetween('15:00', '17:30')).toBe(150)
    expect(durationBetween('23:30', '00:45')).toBe(75)
  })
  it('weeks start on Monday', () => {
    expect(weekStart('2026-11-15')).toBe('2026-11-09') // a Sunday
    expect(weekStart('2026-11-16')).toBe('2026-11-16')
  })
})

describe('lectures-only focus (default)', () => {
  it('is the default for a new account', () => {
    expect(lectureMode().settings.focus).toBe('lectures')
  })
  it('counts a chapter as done once its lectures are watched, nothing else needed', () => {
    const d = lectureMode()
    ch(d, 'aa-01', { totalLectures: 4, lectureMarks: [{ date: '2026-11-16', n: 2 }] })
    let c = stat(d, 'aa-01')
    expect(c.status).toBe('In Progress')
    expect(c.progress).toBe(50)
    expect(c.done).toBe(false)
    ch(d, 'aa-01', { lectureMarks: [{ date: '2026-11-16', n: 4 }] })
    c = stat(d, 'aa-01')
    expect(c.status).toBe('Lectures Completed')
    expect(c.progress).toBe(100)
    expect(c.done).toBe(true)
    const s = summarize(d, '2026-11-20')
    expect(s.completed).toBe(1)
    expect(s.inProgress).toBe(0)
    expect(s.comp.overall).toBeCloseTo(100 / 15 / 6, 5)
  })
  it('does not raise practice or revision backlog', () => {
    const d = lectureMode()
    ch(d, 'aa-01', { totalLectures: 1, lectureMarks: [{ date: '2026-11-16', n: 1 }], nextRevisionDate: '2026-11-01' })
    expect(summarize(d, '2026-11-20').backlog).toHaveLength(0)
  })
  it('still reports lecture pace backlog', () => {
    const d = lectureMode()
    d.subjects = d.subjects.map((x) => (x.id === 'aa' ? { ...x, lectureTargetDate: '2026-11-25' } : x))
    ch(d, 'aa-01', { totalLectures: 10 })
    expect(summarize(d, '2026-11-20').lecturesBehind).toBe(5)
  })
})

describe('chapter status', () => {
  it('lectures alone never complete a chapter', () => {
    const d = base()
    ch(d, 'aa-01', { totalLectures: 4, lectureMarks: [{ date: '2026-11-16', n: 4 }] })
    const c = stat(d, 'aa-01')
    expect(c.lecDone).toBe(true)
    expect(c.status).toBe('Lectures Completed')
    expect(c.progress).toBe(50)
  })
  it('walks through practice and revision gates', () => {
    const d = base()
    ch(d, 'aa-01', { totalLectures: 2, questionTarget: 20, lectureMarks: [{ date: '2026-11-16', n: 1 }] })
    expect(stat(d, 'aa-01').status).toBe('In Progress')
    d.sessions.push(sess({ chapterId: 'aa-01', lecturesCompleted: 1 }))
    d.sessions.push(sess({ chapterId: 'aa-01', activity: 'practice', qAttempted: 10, qCorrect: 6 }))
    expect(stat(d, 'aa-01').status).toBe('Practice Pending')
    d.tests.push({ id: 't', date: '2026-11-17', subjectId: 'aa', chapterId: 'aa-01', type: 'Chapter Test', totalMarks: 20, marks: 12, attempted: 10, correct: 7, incorrect: 3, timeMin: 30 })
    ch(d, 'aa-01', { rtpDone: true })
    let c = stat(d, 'aa-01')
    expect(c.questions).toBe(20)
    expect(c.correct).toBe(13) // attempted and correct stay separate
    expect(c.status).toBe('Revision Pending')
    ch(d, 'aa-01', { revisions: [{ done: true }, { done: false }, { done: false }] })
    c = stat(d, 'aa-01')
    expect(c.status).toBe('Completed')
    expect(c.progress).toBe(100)
    d.settings.requiredRevisions = 3
    expect(stat(d, 'aa-01').status).toBe('Revision Pending')
  })
  it('caps lectures at the total and never goes negative', () => {
    const d = base()
    ch(d, 'aa-01', { totalLectures: 3, lectureMarks: [{ date: '2026-11-16', n: 9 }] })
    expect(stat(d, 'aa-01').lecturesDone).toBe(3)
    ch(d, 'aa-01', { lectureMarks: [{ date: '2026-11-16', n: -2 }] })
    expect(stat(d, 'aa-01').lecturesDone).toBe(0)
  })
})

describe('completion', () => {
  it('pools DT+GST into one paper and keeps groups separate', () => {
    const d = base()
    // complete every DT chapter
    d.chapters = d.chapters.map((c) => (c.subjectId === 'dt' ? { ...c, totalLectures: 1, lectureMarks: [{ date: '2026-11-16', n: 1 }], rtpDone: true, revisions: [{ done: true }, { done: false }, { done: false }] } : c))
    const cs = chapterStats(d)
    const comp = completion(subjectStats(d, cs, '2026-11-20'))
    const tax = comp.papers.find((p) => p.paper === 3)!
    expect(tax.completion).toBeCloseTo((100 * 13) / 28, 5) // 13 DT + 15 GST chapters
    expect(comp.g2).toBe(0)
    expect(comp.g1).toBeCloseTo(tax.completion / 3, 5)
    expect(comp.overall).toBeCloseTo(tax.completion / 6, 5)
  })
})

describe('hours', () => {
  it('categories always sum to the total, zero-hour days are not active', () => {
    const s = [sess({ durationMin: 90 }), sess({ activity: 'self', durationMin: 30 }), sess({ activity: 'rtp', durationMin: 45 }), sess({ activity: 'mock', durationMin: 15 }), sess({ activity: 'revision', durationMin: 20, date: '2026-11-17' }), sess({ durationMin: 0, date: '2026-11-18' })]
    const t = totals(s)
    expect(t.total).toBe(200)
    expect(t.lecture + t.self + t.practice + t.revision).toBe(t.total)
    expect(t.practice).toBe(60)
    expect(activeDays(s)).toBe(2)
  })
  it('streaks', () => {
    const s = ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-15', '2026-11-16'].map((date) => sess({ date }))
    expect(streaks(s, '2026-11-16')).toEqual({ current: 2, best: 3 })
    expect(streaks(s, '2026-11-17').current).toBe(2) // today not logged yet
    expect(streaks(s, '2026-11-18').current).toBe(0)
  })
  it('detects overlapping sessions', () => {
    const a = sess({ id: 'a', start: '15:00', end: '16:00' })
    expect(overlapping([a], { id: 'b', date: a.date, start: '15:30', end: '16:30' })).toHaveLength(1)
    expect(overlapping([a], { id: 'b', date: a.date, start: '16:00', end: '17:00' })).toHaveLength(0)
    expect(overlapping([a], { id: 'a', date: a.date, start: '15:10', end: '15:50' })).toHaveLength(0) // editing itself
  })
})

describe('backlog', () => {
  it('flags pace, practice, revision and missed plans, then spreads without overloading', () => {
    const d = base()
    d.settings.startDate = '2026-11-15'
    d.subjects = d.subjects.map((s) => (s.id === 'aa' ? { ...s, lectureTargetDate: '2026-11-25', avgLectureMin: 120 } : s))
    ch(d, 'aa-01', { totalLectures: 10, lectureMarks: [{ date: '2026-11-16', n: 2 }] })
    ch(d, 'law-01', { totalLectures: 1, lectureMarks: [{ date: '2026-11-16', n: 1 }] })
    d.plans.push({ id: 'p1', date: '2026-11-18', kind: 'lecture', subjectId: 'dt', title: 'DT lecture', plannedMin: 90, done: false })
    d.plans.push({ id: 'p2', date: '2026-11-18', kind: 'college', title: 'College', plannedMin: 300, done: false })
    const s = summarize(d, '2026-11-20')
    expect(s.lecturesBehind).toBe(3) // expected floor(10 * 5/10) = 5, done 2
    const types = s.backlog.map((b) => b.type).sort()
    expect(types).toEqual(['lecture', 'plan', 'practice', 'revision'])
    const lec = s.backlog.find((b) => b.type === 'lecture')!
    expect(lec.minutes).toBe(360)
    const { plans, leftoverMin } = distribute(s.backlog, '2026-11-21', 3, 120)
    const perDay = new Map<string, number>()
    plans.forEach((p) => perDay.set(p.date, (perDay.get(p.date) ?? 0) + p.plannedMin))
    expect(Math.max(...perDay.values())).toBeLessThanOrEqual(120)
    expect([...perDay.values()].reduce((a, b) => a + b, 0) + leftoverMin).toBe(s.backlogMin)
    expect(leftoverMin).toBeGreaterThan(0)
    expect(backlog(d, s.cs, s.ss, '2026-11-17').some((b) => b.type === 'plan')).toBe(false) // plan not yet in the past
  })
})

describe('reviews', () => {
  it('weekly totals, lectures and missed plans', () => {
    const d = base()
    d.settings.weeklyTargets = { aa: 5 }
    d.sessions.push(sess({ date: '2026-11-16', lecturesCompleted: 2, chapterId: 'aa-01', durationMin: 120 }), sess({ date: '2026-11-22', activity: 'practice', qAttempted: 10, qCorrect: 4 }), sess({ date: '2026-11-23' }))
    ch(d, 'aa-02', { lectureMarks: [{ date: '2026-11-18', n: 1 }, { date: '2026-11-30', n: 1 }] })
    d.plans.push({ id: 'p', date: '2026-11-19', kind: 'revision', title: 'x', plannedMin: 45, done: false })
    const r = periodReview(d, '2026-11-16', '2026-11-22')
    expect(r.totals.total).toBe(180)
    expect(r.activeDays).toBe(2)
    expect(r.lectures).toBe(3)
    expect(r.missedCount).toBe(1)
    expect(r.missedMin).toBe(45)
    expect(r.qAttempted).toBe(10)
    expect(r.qCorrect).toBe(4)
    expect(r.bySubject.find((s) => s.subject.id === 'aa')).toMatchObject({ minutes: 180, targetMin: 300 })
  })
})

describe('push reminders', () => {
  const rem = [{ id: 'r', time: '16:00', label: 'x', enabled: true }]
  it('fires once inside the window in the subscriber time zone', () => {
    const at = (iso: string) => new Date(iso)
    expect(dueReminders({ reminders: rem, sent: [], tz: 'Asia/Kolkata' }, at('2026-11-16T10:32:00Z')).due).toHaveLength(1) // 16:02 IST
    expect(dueReminders({ reminders: rem, sent: [], tz: 'Asia/Kolkata' }, at('2026-11-16T10:29:00Z')).due).toHaveLength(0) // 15:59
    expect(dueReminders({ reminders: rem, sent: [], tz: 'Asia/Kolkata' }, at('2026-11-16T10:37:00Z')).due).toHaveLength(0) // 16:07
    expect(dueReminders({ reminders: rem, sent: ['2026-11-16|r'], tz: 'Asia/Kolkata' }, at('2026-11-16T10:32:00Z')).due).toHaveLength(0)
    expect(dueReminders({ reminders: [{ ...rem[0], enabled: false }], sent: [], tz: 'Asia/Kolkata' }, at('2026-11-16T10:32:00Z')).due).toHaveLength(0)
  })
})
