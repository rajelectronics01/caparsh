import { describe, expect, it } from 'vitest'
import { markLecture, tickLectures, toggleLecture } from './actions'
import { backlog, chapterStats, dailyLectures, lecturesInRange, nextUp, summarize } from './analytics'
import { LAW_EXTRA, lectureUnits, parseAA, parseDT, parseDuration, parseLaw, planListImport, unitDone, unitOf, unitRemainingMin, unitTitle, watchOrder } from './lectureLists'
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

describe('watching order', () => {
  const loaded = (key: 'aa' | 'law' | 'dt') => {
    const d = fresh()
    const plan = planListImport(d, key)
    d.chapters = [...d.chapters.map((c) => plan.chapters.find((x) => x.id === c.id) ?? c), ...plan.chapters.filter((x) => !d.chapters.some((c) => c.id === x.id))]
    return d
  }
  it('Advanced Accounting runs 01 Part 1, 01 Part 2, 02 Part 1... exactly as your list, though they sit in different chapters', () => {
    const d = loaded('aa')
    const ord = watchOrder(d.chapters.filter((c) => c.subjectId === 'aa'))
    expect(ord.map((o) => o.lecture.title)).toEqual(parseAA().map((l) => l.title))
    expect(ord[0]).toMatchObject({ n: 1, chapter: { id: 'aa-01' } })
    expect(ord[2].lecture.title).toBe('02 Part 1 - AS 2')
    expect(ord[2].chapter.id).toBe('aa-05') // lecture 3 of the batch lives in "Assets Based Accounting Standards"
    expect(ord[174].lecture.title).toBe('86 Part 2 - AS 11')
  })
  it('Direct Tax runs Day 1 to Day 63', () => {
    const d = loaded('dt')
    const ord = watchOrder(d.chapters.filter((c) => c.subjectId === 'dt'))
    expect(ord.map((o) => o.lecture.title)).toEqual(parseDT().map((l) => l.title))
    expect(ord[0].lecture.title).toBe('DAY -1 PART-1 BASIC AND INTRODUCATION')
  })
  it('Law follows the batch (General Clauses, Interpretation and FEMA come before LLP)', () => {
    const d = loaded('law')
    const ord = watchOrder(d.chapters.filter((c) => c.subjectId === 'law'))
    expect(ord.map((o) => o.lecture.title)).toEqual(parseLaw().lectures.map((l) => l.title))
    const chapterOrder = [...new Set(ord.map((o) => o.chapter.id))]
    expect(chapterOrder.indexOf('law-13')).toBeLessThan(chapterOrder.indexOf('law-12'))
    expect(chapterOrder.indexOf('law-15')).toBeLessThan(chapterOrder.indexOf('law-12'))
  })
  it('lectures you add yourself go last', () => {
    const d = loaded('aa')
    d.chapters = d.chapters.map((c) => (c.id === 'aa-01' ? { ...c, lectures: [...c.lectures!, { id: 'x', title: 'My extra', minutes: 30, done: false }] } : c))
    const ord = watchOrder(d.chapters.filter((c) => c.subjectId === 'aa'))
    expect(ord[ord.length - 1].lecture.title).toBe('My extra')
  })
  it('home suggestions and the next lecture follow it', () => {
    const d = loaded('aa')
    const s = summarize(d, '2026-11-20')
    const n = nextUp(d, s, '2026-11-20', 8).find((x) => x.subjectId === 'aa')!
    expect(n.title).toBe('Adv Acc: Lecture 01 · Intro and Sch III')
    expect(n.why).toContain('2 parts')
    // watch the first two, and the next suggestion moves on to lecture 3, which is in a different chapter
    d.chapters = d.chapters.map((c) => (c.id === 'aa-01' ? markLecture(c, 2) : c))
    const n2 = nextUp(d, summarize(d, '2026-11-20'), '2026-11-20', 8).find((x) => x.subjectId === 'aa')!
    expect(n2.title).toBe('Adv Acc: Lecture 02 · AS 2')
    expect(n2.chapterId).toBe('aa-05')
    expect(n2.why).toContain('2 parts')
  })
})

describe('lecture titles', () => {
  it('are unique within each list, so the faculty order can be looked up by title', () => {
    for (const list of [parseAA(), parseDT(), parseLaw().lectures]) {
      const titles = list.map((l) => l.title)
      expect(new Set(titles).size).toBe(titles.length)
    }
  })
  it('a lecture moved to another chapter keeps its place in the watching order', () => {
    const d = fresh()
    const plan = planListImport(d, 'aa')
    d.chapters = d.chapters.map((c) => plan.chapters.find((x) => x.id === c.id) ?? c)
    const c1 = d.chapters.find((c) => c.id === 'aa-01')!
    const moving = c1.lectures![1] // 01 Part 2 - Intro and Sch III
    d.chapters = d.chapters.map((c) => (c.id === 'aa-01' ? { ...c, lectures: [c.lectures![0]], totalLectures: 1 } : c.id === 'aa-02' ? { ...c, lectures: [moving], totalLectures: 1 } : c))
    const ord = watchOrder(d.chapters.filter((c) => c.subjectId === 'aa'))
    expect(ord[1].lecture.title).toBe('01 Part 2 - Intro and Sch III')
    expect(ord[1].chapter.id).toBe('aa-02')
    expect(chapterStats(d).find((c) => c.chapter.id === 'aa-02')!.totalLectures).toBe(1)
  })
})

describe('ticking chosen lectures', () => {
  it('ticks exactly the lectures chosen, dated to the day watched, and nothing else', () => {
    const d = fresh()
    const plan = planListImport(d, 'aa')
    const ch = plan.chapters.find((c) => c.id === 'aa-12')! // five Buy Back lectures
    const ids = [ch.lectures![1].id, ch.lectures![3].id] // skip the first, take 2nd and 4th
    const out = tickLectures(ch, ids, '2026-11-17')
    expect(out.lectures!.map((l) => l.done)).toEqual([false, true, false, true, false])
    expect(out.lectures![1].doneAt).toBe('2026-11-17')
    expect(out.lectures![0].doneAt).toBeUndefined()
    // already-watched lectures keep their original date, and an empty choice changes nothing
    const again = tickLectures(out, [ch.lectures![1].id, ch.lectures![2].id], '2026-11-20')
    expect(again.lectures![1].doneAt).toBe('2026-11-17')
    expect(again.lectures![2].doneAt).toBe('2026-11-20')
    expect(tickLectures(ch, [], '2026-11-17')).toBe(ch)
  })
  it('a partly watched lecture is finished by ticking it', () => {
    const d = fresh()
    const ch = planListImport(d, 'aa').chapters.find((c) => c.id === 'aa-01')!
    expect(ch.lectures![0].pct).toBe(70)
    const out = tickLectures(ch, [ch.lectures![0].id], '2026-11-17')
    expect(out.lectures![0]).toMatchObject({ done: true, pct: undefined })
  })
})

describe('one lecture = all its parts', () => {
  const load = (keys: ('aa' | 'law' | 'dt')[]) => {
    const d = fresh()
    for (const k of keys) {
      const plan = planListImport(d, k)
      d.chapters = [...d.chapters.map((c) => plan.chapters.find((x) => x.id === c.id) ?? c), ...plan.chapters.filter((x) => !d.chapters.some((c) => c.id === x.id))]
      d.subjects = d.subjects.map((x) => plan.subjects.find((y) => y.id === x.id) ?? x)
    }
    return d
  }
  const units = (d: ReturnType<typeof fresh>, sid: string) => lectureUnits(d.chapters.filter((c) => c.subjectId === sid))
  it('Advanced Accounting: 175 recordings are 86 lectures; Part 1 and Part 2 belong together', () => {
    const u = units(load(['aa']), 'aa')
    expect(u).toHaveLength(86)
    const parts = (label: string) => u.find((x) => x.label === label)!.parts.map((p) => p.lecture.title)
    expect(parts('Lecture 01')).toEqual(['01 Part 1 - Intro and Sch III', '01 Part 2 - Intro and Sch III'])
    expect(parts('Lecture 02')).toHaveLength(2)
    expect(parts('Lecture 48')).toHaveLength(3) // Part 1, 2, 3
    expect(parts('Lecture 82')).toHaveLength(3)
    expect(parts('Lecture 85')).toHaveLength(3)
    expect(parts('Lecture 33')).toHaveLength(3) // Part 1, Part 1 A (motivation), Part 2
    expect(parts('Lecture 54')).toEqual(['54 Part 1 - AS 1', '54 Part 1 - AS 5']) // two recordings both labelled Part 1
    expect(parts('Lecture 74')).toEqual(['74 - AS 27']) // a single recording
    expect(u.reduce((a, x) => a + x.parts.length, 0)).toBe(175)
  })
  it('Direct Tax: each Day is a lecture (Day 1 has two parts); Law: every lecture stands alone', () => {
    const dt = units(load(['dt']), 'dt')
    expect(dt).toHaveLength(63)
    expect(dt[0].parts).toHaveLength(2)
    expect(dt[0].label).toBe('Day 1')
    const law = units(load(['law']), 'law')
    expect(law).toHaveLength(94)
    expect(law.every((x) => x.parts.length === 1)).toBe(true)
  })
  it('unit helpers', () => {
    expect(unitOf('aa', '01 Part 2 - Intro and Sch III')).toEqual({ key: 'aa|01', label: 'Lecture 01' })
    expect(unitOf('dt', 'Day -2 Basic And Tax Notes').key).toBe('dt|2')
    expect(unitOf('law', 'Lecture 1.3').key).toBe('law|Lecture 1.3')
    const d = load(['aa'])
    const u1 = units(d, 'aa')[0]
    expect(unitTitle(u1)).toBe('Lecture 01 · Intro and Sch III')
    expect(unitRemainingMin(u1, 90)).toBeCloseTo(111 * 0.3 + 63, 5) // part 1 is 70% watched
    const dtUnit = lectureUnits(load(['dt']).chapters.filter((c) => c.subjectId === 'dt'))[0]
    expect(unitTitle(dtUnit)).toBe('Day 1 · BASIC AND INTRODUCATION')
    expect(unitDone(u1)).toBe(false)
  })
  it('the next-up suggestion is the whole lecture, with both parts pre-selected', () => {
    const d = load(['aa'])
    const n = nextUp(d, summarize(d, '2026-11-18'), '2026-11-18', 8).find((x) => x.subjectId === 'aa')!
    expect(n.title).toBe('Adv Acc: Lecture 01 · Intro and Sch III')
    expect(n.why).toContain('2 parts')
    expect(n.lectureKeys).toEqual(['aa-01|aa-01-1', 'aa-01|aa-01-2'])
    expect(n.minutes).toBe(Math.round(111 * 0.3 + 63))
  })
})

describe('the daily Group 1 plan', () => {
  const load = () => {
    const d = fresh()
    for (const k of ['aa', 'law', 'dt'] as const) {
      const plan = planListImport(d, k)
      d.chapters = [...d.chapters.map((c) => plan.chapters.find((x) => x.id === c.id) ?? c), ...plan.chapters.filter((x) => !d.chapters.some((c) => c.id === x.id))]
    }
    return d
  }
  const finish = (d: ReturnType<typeof fresh>, sid: string, n: number, date: string) => {
    // watch the first n lectures (all their parts), dated `date`
    const us = lectureUnits(d.chapters.filter((c) => c.subjectId === sid)).slice(0, n)
    const ids = new Set(us.flatMap((u) => u.parts.map((p) => `${p.chapter.id}|${p.lecture.id}`)))
    d.chapters = d.chapters.map((c) => (c.lectures ? { ...c, lectures: c.lectures.map((l) => (ids.has(`${c.id}|${l.id}`) ? { ...l, done: true, pct: undefined, doneAt: date } : l)) } : c))
  }
  const rows = (d: ReturnType<typeof fresh>, today: string) => dailyLectures(d, summarize(d, today).ss, today)
  const row = (d: ReturnType<typeof fresh>, today: string, id: string) => rows(d, today).find((r) => r.subject.id === id)!

  it('covers Adv Acc, Law and Direct Tax, and shows GST waiting for Direct Tax', () => {
    const r = rows(load(), '2026-11-18')
    expect(r.map((x) => x.subject.id)).toEqual(['aa', 'law', 'dt', 'gst'])
    expect(r.find((x) => x.subject.id === 'gst')).toMatchObject({ locked: true, startsAfterName: 'Income Tax (Direct Tax)' })
    expect(r.find((x) => x.subject.id === 'aa')!.next!.label).toBe('Lecture 01')
  })
  it('counts one lecture a day from the preparation start: 3 days behind on the 18th with nothing watched', () => {
    const d = load() // preparation starts 15 Nov
    expect(row(d, '2026-11-18', 'aa')).toMatchObject({ behind: 3, unitsDone: 0, unitsTotal: 86 })
    expect(row(d, '2026-11-15', 'aa').behind).toBe(0) // the first day: today's lecture is not behind yet
    expect(row(d, '2026-11-14', 'aa').behind).toBe(0) // before the start
  })
  it('watching today\'s lecture does not clear days already missed; catching up does', () => {
    const d = load()
    finish(d, 'aa', 1, '2026-11-18')
    let a = row(d, '2026-11-18', 'aa')
    expect(a.doneToday).toHaveLength(1)
    expect(a.behind).toBe(3) // 15th, 16th, 17th still owed
    finish(d, 'aa', 4, '2026-11-18') // four lectures today = caught up
    a = row(d, '2026-11-18', 'aa')
    expect(a.behind).toBe(0)
    expect(a.next!.label).toBe('Lecture 05')
  })
  it('lectures watched on earlier days count towards the plan', () => {
    const d = load()
    finish(d, 'law', 2, '2026-11-16')
    expect(row(d, '2026-11-18', 'law')).toMatchObject({ unitsDone: 2, behind: 1, doneToday: [] }) // owed 4-2=2, minus today's own
  })
  it('a half-watched lecture is not done', () => {
    const d = load()
    const ch = d.chapters.find((c) => c.id === 'aa-01')!
    d.chapters = d.chapters.map((c) => (c.id === 'aa-01' ? { ...ch, lectures: ch.lectures!.map((l, i) => (i === 0 ? { ...l, done: true, doneAt: '2026-11-18' } : l)) } : c))
    const a = row(d, '2026-11-18', 'aa')
    expect(a.unitsDone).toBe(0)
    expect(a.doneToday).toHaveLength(0)
    expect(a.next!.parts.filter((p) => !p.lecture.done)).toHaveLength(1) // only Part 2 left
  })
  it('GST joins the plan the day after Direct Tax is finished', () => {
    const d = load()
    d.chapters = d.chapters.map((c) => (c.id === 'gst-01' ? { ...c, lectures: [{ id: 'g1', title: 'GST Lecture 1', minutes: 120, done: false }, { id: 'g2', title: 'GST Lecture 2', minutes: 120, done: false }], totalLectures: 2 } : c))
    expect(row(d, '2026-11-19', 'gst').locked).toBe(true) // still waiting while Direct Tax lectures remain
    finish(d, 'dt', 63, '2026-11-20')
    const g = row(d, '2026-11-21', 'gst')
    expect(g.locked).toBe(false)
    expect(g.since).toBe('2026-11-21')
    expect(g.behind).toBe(0)
  })
  it('the backlog lists lectures behind the one-a-day plan with the time they take', () => {
    const d = load()
    const s = summarize(d, '2026-11-18')
    const item = s.backlog.find((b) => b.key === 'daily-aa')!
    expect(item.title).toBe('Adv Acc: 3 lectures behind the one-a-day plan')
    const units3 = lectureUnits(d.chapters.filter((c) => c.subjectId === 'aa')).slice(0, 3)
    expect(item.minutes).toBeCloseTo(units3.reduce((a, u) => a + unitRemainingMin(u, 83), 0), 0)
    expect(s.backlog.some((b) => b.key === 'lec-aa')).toBe(false) // no second, target-date item for it
    expect(s.lecturesBehind).toBe(3 + 3 + 3) // Adv Acc, Law and Direct Tax
    expect(backlog(d, s.cs, s.ss, '2026-11-18').filter((b) => b.key.startsWith('daily-'))).toHaveLength(3)
  })
})
