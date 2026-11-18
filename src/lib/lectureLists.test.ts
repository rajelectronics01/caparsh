import { describe, expect, it } from 'vitest'
import { markLecture, toggleLecture } from './actions'
import { chapterStats, lecturesInRange, nextUp, summarize } from './analytics'
import { LAW_EXTRA, parseAA, parseDT, parseDuration, parseLaw, planListImport } from './lectureLists'
import { seedRecords } from './seed'
import { assemble } from './store'

const fresh = () => assemble(seedRecords())
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

describe('durations', () => {
  it('parses hours and minutes', () => {
    expect(parseDuration('· 1h 51m · 70%')).toBe(111)
    expect(parseDuration('· 55m')).toBe(55)
    expect(parseDuration('· 2h')).toBe(120)
    expect(parseDuration('· 3m')).toBe(3)
    expect(parseDuration('')).toBe(0)
  })
})

describe('Advanced Accounting list', () => {
  const aa = parseAA()
  it('loads every part: 175 items', () => {
    expect(aa).toHaveLength(175)
  })
  it('keeps the partial progress of the two lectures already started', () => {
    expect(aa[0]).toMatchObject({ title: '01 Part 1 - Intro and Sch III', minutes: 111, pct: 70 })
    expect(aa[2]).toMatchObject({ title: '02 Part 1 - AS 2', minutes: 121, pct: 59 })
    expect(aa.filter((l) => l.pct != null)).toHaveLength(2)
  })
  it('puts every lecture in one of the app\'s chapters, and the standards in the right groups', () => {
    const by = (id: string) => aa.filter((l) => l.chapterId === id)
    expect(by('aa-01')).toHaveLength(2) // Intro and Sch III
    expect(by('aa-02')).toHaveLength(0) // no lectures for Framework in this batch
    expect(by('aa-03')).toHaveLength(0)
    expect(by('aa-12')).toHaveLength(5) // buy back: 25 P1, 25 P2, 26 P1, 26 P2, 27 P1
    expect(by('aa-13').length).toBe(18) // amalgamation: 40 P2, then 41-47 in two parts each, then 48 P1-P3
    expect(by('aa-14')).toHaveLength(8) // internal reconstruction
    expect(by('aa-15')).toHaveLength(13) // branches: 80-81 (2 each), 82 (3), 83-84 (2 each), 85 P1-P2
    expect(by('aa-11')).toHaveLength(9) // preparation of FS: 59-62 (2 each) and 63 P1
    expect(aa.every((l) => /^aa-\d\d$/.test(l.chapterId))).toBe(true)
    expect(by('aa-05').some((l) => l.title.includes('AS 10 AND AS 26'))).toBe(true)
    expect(by('aa-04').some((l) => l.title.includes('Cash Flow'))).toBe(true)
    expect(by('aa-04').some((l) => l.title.includes('Motivation'))).toBe(true)
    expect(by('aa-04').some((l) => l.title.includes('AS 1') && l.title.startsWith('54'))).toBe(true)
    expect(by('aa-07').some((l) => l.title.includes('AS 11'))).toBe(true)
    expect(by('aa-09').every((l) => l.title.includes('AS 12'))).toBe(true)
  })
  it('every part has a duration and the total is plausible', () => {
    const total = sum(aa.map((l) => l.minutes))
    expect(aa.every((l) => l.minutes > 0)).toBe(true)
    expect(total).toBeGreaterThan(200 * 60)
    expect(total).toBeLessThan(260 * 60)
  })
})

describe('Law list', () => {
  const law = parseLaw()
  const by = (id: string) => law.lectures.filter((l) => l.chapterId === id)
  it('maps the batch\'s chapter order onto the ICAI chapters', () => {
    expect(by('law-13')).toHaveLength(4) // General Clauses Act (batch ch 12)
    expect(by('law-14')).toHaveLength(3) // Interpretation of Statutes (batch ch 13)
    expect(by('law-15')).toHaveLength(5) // FEMA (batch ch 14)
    expect(by('law-12')).toHaveLength(6) // LLP (batch ch 15)
  })
  it('counts each chapter as listed', () => {
    const counts = Object.fromEntries(Array.from({ length: 16 }, (_, i) => `law-${String(i + 1).padStart(2, '0')}`).map((id) => [id, by(id).length]))
    expect(counts).toMatchObject({ 'law-01': 5, 'law-02': 11, 'law-03': 10, 'law-04': 11, 'law-05': 3, 'law-06': 4, 'law-07': 11, 'law-08': 6, 'law-09': 5, 'law-10': 6, 'law-11': 2, 'law-16': 2 })
  })
  it('keeps the quirky titles in the right chapter', () => {
    expect(by('law-07').some((l) => l.title.startsWith('Chapter 7 - Management'))).toBe(true)
    expect(by('law-08').some((l) => l.title.includes('QB Discussion'))).toBe(true)
    expect(by('law-10').some((l) => l.title.startsWith('Question Bank'))).toBe(true)
    expect(by('law-13').map((l) => l.minutes)).toEqual([114, 120, 130, 122])
  })
  it('leaves out the special session and says so', () => {
    expect(law.skipped).toEqual(['The One Where You Get To Know Your CA Buddy'])
    expect(law.lectures.some((l) => l.title.includes('CA Buddy'))).toBe(false)
  })
  it('records lectures with no duration as 0 minutes', () => {
    expect(by('law-01').map((l) => l.minutes)).toEqual([0, 0, 155, 163, 151])
  })
  it('reads the count printed next to each chapter', () => {
    expect(law.headerCounts['law-01']).toBe(7)
    expect(law.headerCounts['law-12']).toBe(6)
    expect(law.headerCounts['law-16']).toBe(2)
  })
})

describe('importing a list', () => {
  it('fills chapter lectures, creates the extra Law chapter, and reports gaps', () => {
    const d = fresh()
    const aa = planListImport(d, 'aa')
    expect(aa.lectures).toBe(175)
    expect(aa.untouched).toEqual(['Framework for Preparation and Presentation of Financial Statements', 'Applicability of Accounting Standards'])
    const law = planListImport(d, 'law')
    expect(law.created).toEqual([LAW_EXTRA.name])
    expect(law.chapters.find((c) => c.id === 'law-16')!.lectures).toHaveLength(2)
    expect(law.mismatches.map((m) => `${m.chapterId}:${m.listed}/${m.platform}`)).toEqual(['law-01:5/7', 'law-02:11/13', 'law-03:10/13'])
    expect(law.untouched).toEqual([])
  })
  it('re-importing keeps what was ticked', () => {
    const d = fresh()
    d.chapters = d.chapters.map((c) => planListImport(d, 'aa').chapters.find((x) => x.id === c.id) ?? c)
    const first = d.chapters.find((c) => c.id === 'aa-12')!
    d.chapters = d.chapters.map((c) => (c.id === 'aa-12' ? markLecture(first, 2) : c))
    const again = planListImport(d, 'aa').chapters.find((c) => c.id === 'aa-12')!
    expect(again.lectures!.filter((l) => l.done)).toHaveLength(2)
  })
})

describe('calculations with a lecture list', () => {
  const withList = () => {
    const d = fresh()
    const plan = planListImport(d, 'aa')
    d.chapters = d.chapters.map((c) => plan.chapters.find((x) => x.id === c.id) ?? c)
    return d
  }
  const st = (d: ReturnType<typeof fresh>, id: string) => chapterStats(d).find((c) => c.chapter.id === id)!
  it('counts ticked lectures and the exact minutes left', () => {
    const d = withList()
    const base = st(d, 'aa-12')
    expect(base.totalLectures).toBe(5)
    expect(base.remainingMin).toBe(91 + 75 + 94 + 70 + 106)
    d.chapters = d.chapters.map((c) => (c.id === 'aa-12' ? markLecture(c, 1) : c))
    const after = st(d, 'aa-12')
    expect(after.lecturesDone).toBe(1)
    expect(after.remainingMin).toBe(base.remainingMin! - 91)
    expect(after.progress).toBeCloseTo(100 / 5, 5)
  })
  it('counts a partly watched lecture in part, and starts the chapter', () => {
    const d = withList()
    const c = st(d, 'aa-01')
    expect(c.status).toBe('In Progress')
    expect(c.lecturesDone).toBe(0)
    // 70% of 111m watched, 59% not in this chapter; (0.7 + 0) / 2 lectures
    expect(c.lecturePct).toBeCloseTo(35, 5)
    expect(c.remainingMin).toBeCloseTo(111 * 0.3 + 63, 5)
  })
  it('finishes a chapter when every lecture is ticked, and exposes it in the totals', () => {
    const d = withList()
    d.chapters = d.chapters.map((c) => (c.id === 'aa-12' ? markLecture(c, 99) : c))
    expect(st(d, 'aa-12').done).toBe(true)
    expect(summarize(d, '2026-11-20').completed).toBe(1)
  })
  it('does not count session lecture numbers twice for a listed chapter', () => {
    const d = withList()
    d.sessions.push({ id: 's', date: '2026-11-17', subjectId: 'aa', chapterId: 'aa-12', activity: 'lecture', durationMin: 90, lecturesCompleted: 3, status: 'completed' })
    expect(st(d, 'aa-12').lecturesDone).toBe(0)
    expect(lecturesInRange(d, '2026-11-01', '2026-11-30', 'aa')).toBe(0)
  })
  it('weekly lecture counts use the date a lecture was ticked', () => {
    const d = withList()
    const ch = d.chapters.find((c) => c.id === 'aa-12')!
    const ticked = { ...ch, lectures: ch.lectures!.map((l, i) => (i < 2 ? { ...l, done: true, doneAt: '2026-11-18' } : l)) }
    d.chapters = d.chapters.map((c) => (c.id === 'aa-12' ? ticked : c))
    expect(lecturesInRange(d, '2026-11-16', '2026-11-22', 'aa')).toBe(2)
    expect(lecturesInRange(d, '2026-11-23', '2026-11-29', 'aa')).toBe(0)
  })
  it('toggling one lecture and unticking work', () => {
    const d = withList()
    let c = d.chapters.find((x) => x.id === 'aa-12')!
    c = toggleLecture(c, c.lectures![2].id)
    expect(c.lectures!.map((l) => l.done)).toEqual([false, false, true, false, false])
    c = markLecture(c, -1)
    expect(c.lectures!.filter((l) => l.done)).toHaveLength(0)
  })
  it('subject average length comes from the list', () => {
    const d = withList()
    const s = summarize(d, '2026-11-20').ss.find((x) => x.subject.id === 'aa')!
    expect(s.totalLectures).toBe(175)
    expect(s.avgIsMeasured).toBe(true)
    expect(s.avgLectureMin).toBeCloseTo(14587 / 175, 5)
    expect(s.avgLectureMin).toBeGreaterThan(75)
    expect(s.avgLectureMin).toBeLessThan(100)
  })
})

describe('Direct Tax list', () => {
  const dt = parseDT()
  const by = (id: string) => dt.filter((l) => l.chapterId === id)
  it('loads 64 lectures, 173h 27m, all with a length', () => {
    expect(dt).toHaveLength(64)
    expect(dt.every((l) => l.minutes > 0)).toBe(true)
    expect(sum(dt.map((l) => l.minutes))).toBe(10407)
    expect(dt[0]).toMatchObject({ title: 'DAY -1 PART-1 BASIC AND INTRODUCATION', minutes: 99 })
    expect(dt[1].minutes).toBe(46)
    expect(dt[58].title).toBe('Day -58 Adv Tax')
    expect(dt[63]).toMatchObject({ title: 'Day -63 TDS TCS', minutes: 231 })
  })
  it('files every day under the right chapter', () => {
    const counts = Object.fromEntries(Array.from({ length: 13 }, (_, i) => `dt-${String(i + 1).padStart(2, '0')}`).map((id) => [id, by(id).length]))
    expect(counts).toEqual({ 'dt-01': 9, 'dt-02': 4, 'dt-03': 7, 'dt-04': 5, 'dt-05': 12, 'dt-06': 9, 'dt-07': 5, 'dt-08': 2, 'dt-09': 2, 'dt-10': 1, 'dt-11': 5, 'dt-12': 2, 'dt-13': 1 })
  })
  it('puts the mixed days where they start', () => {
    expect(by('dt-05').some((l) => l.title.includes('PGBP And Clubbing'))).toBe(true)
    expect(by('dt-12').some((l) => l.title.includes('Return File And Adv Tax'))).toBe(true)
    expect(by('dt-13')[0].title).toContain('Alternat minimum tax')
  })
  it('imports into every Direct Tax chapter and tells GST to wait', () => {
    const d = fresh()
    d.subjects = d.subjects.map((x) => (x.id === 'gst' ? { ...x, startsAfter: undefined } : x)) // an older account without the rule
    const plan = planListImport(d, 'dt')
    expect(plan.lectures).toBe(64)
    expect(plan.untouched).toEqual([])
    expect(plan.chapters).toHaveLength(13)
    expect(plan.subjects).toHaveLength(1)
    expect(plan.subjects[0]).toMatchObject({ id: 'gst', startsAfter: 'dt' })
  })
})

describe('a subject that starts after another', () => {
  const setup = () => {
    const d = fresh()
    const dtPlan = planListImport(d, 'dt')
    d.chapters = d.chapters.map((c) => dtPlan.chapters.find((x) => x.id === c.id) ?? c)
    d.chapters = d.chapters.map((c) => (c.id === 'gst-01' ? { ...c, totalLectures: 10 } : c))
    d.subjects = d.subjects.map((x) => (x.id === 'gst' ? { ...x, lectureTargetDate: '2026-12-01' } : x))
    return d
  }
  const gst = (d: ReturnType<typeof fresh>) => summarize(d, '2026-11-25').ss.find((x) => x.subject.id === 'gst')!
  it('new accounts have GST waiting for Direct Tax', () => {
    expect(fresh().subjects.find((x) => x.id === 'gst')!.startsAfter).toBe('dt')
  })
  it('is locked with no pace and no suggestions while Direct Tax lectures remain', () => {
    const d = setup()
    expect(gst(d).locked).toBe(true)
    expect(gst(d).startsAfterName).toBe('Income Tax (Direct Tax)')
    expect(gst(d).behind).toBe(0)
    const s = summarize(d, '2026-11-25')
    expect(nextUp(d, s, '2026-11-25', 8).some((n) => n.subjectId === 'gst')).toBe(false)
  })
  it('unlocks the moment every Direct Tax lecture is watched', () => {
    const d = setup()
    d.chapters = d.chapters.map((c) => (c.subjectId === 'dt' ? markLecture(c, 999) : c))
    expect(gst(d).locked).toBe(false)
    expect(gst(d).behind).toBeGreaterThan(0)
  })
  it('does not lock when the earlier subject has no lectures entered yet', () => {
    const d = fresh()
    expect(gst(d).locked).toBe(false)
  })
})
