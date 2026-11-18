import type { Chapter, Data, Lecture, Subject } from './types'
import { newChapter } from './seed'
import aaRaw from './data/aa-lectures.txt?raw'
import dtRaw from './data/dt-lectures.txt?raw'
import lawRaw from './data/law-lectures.txt?raw'

/** "1h 51m" -> 111, "55m" -> 55, "2h" -> 120. */
export function parseDuration(s: string): number {
  const h = /(\d+)\s*h/.exec(s)
  const m = /(\d+)\s*m/.exec(s)
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0)
}
// A duration line looks like "· 1h 51m", "· 55m" or "· 1h 51m · 70%". A bare "· 7" is a count, not a duration.
const isDurationLine = (l: string) => /^·/.test(l) && /\d\s*[hm]\b/.test(l)
const pctOf = (l: string) => {
  const m = /·\s*(\d+)\s*%/.exec(l)
  return m ? Number(m[1]) : undefined
}

export interface ParsedLecture {
  chapterId: string
  title: string
  minutes: number // 0 when the list gave no duration
  pct?: number
}

/** Which app chapter an Advanced Accounting lecture belongs to, from the faculty's topic label (the ICAI chapter groupings of the accounting standards). */
const AA_BY_AS: Record<number, string> = {
  1: 'aa-04', 3: 'aa-04', 17: 'aa-04', 18: 'aa-04', 20: 'aa-04', 24: 'aa-04', 25: 'aa-04',
  2: 'aa-05', 10: 'aa-05', 13: 'aa-05', 16: 'aa-05', 19: 'aa-05', 26: 'aa-05', 28: 'aa-05',
  15: 'aa-06', 29: 'aa-06',
  4: 'aa-07', 5: 'aa-07', 11: 'aa-07', 22: 'aa-07',
  7: 'aa-08', 9: 'aa-08',
  12: 'aa-09', 14: 'aa-09',
  21: 'aa-10', 23: 'aa-10', 27: 'aa-10',
}
export function aaChapter(topic: string): string | null {
  const t = topic.toLowerCase().trim()
  if (t.startsWith('intro')) return 'aa-01'
  if (t.startsWith('buy back')) return 'aa-12'
  if (t.startsWith('cash flow') || t.startsWith('motivation')) return 'aa-04' // cash flow is AS 3
  if (t.startsWith('amalgamation')) return 'aa-13'
  if (t.startsWith('internal reco')) return 'aa-14'
  if (t.startsWith('prep of fs')) return 'aa-11'
  if (t.startsWith('branch')) return 'aa-15'
  const as = /^as\s*(\d+)/.exec(t) // "AS 10 AND AS 26" is filed under its first standard (same chapter)
  return as ? (AA_BY_AS[Number(as[1])] ?? null) : null
}

export function parseAA(raw: string = aaRaw): ParsedLecture[] {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
  const out: ParsedLecture[] = []
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\d{2})(?:\s+Part\s*\d+(?:\s+[A-Z])?)?\s*-\s*(.+)$/i.exec(lines[i])
    if (!m) continue
    const dur = lines[i + 1] && isDurationLine(lines[i + 1]) ? lines[i + 1] : ''
    const chapterId = aaChapter(m[2])
    if (!chapterId) throw new Error(`Unmapped Advanced Accounting topic: ${lines[i]}`)
    out.push({ chapterId, title: lines[i], minutes: parseDuration(dur), pct: pctOf(dur) })
    if (dur) i++
  }
  return out
}

/** Teacher chapter number -> app chapter id (the batch teaches LLP last; ICAI lists it before the other laws). */
const LAW_CHAPTER: Record<number, string> = { 1: 'law-01', 2: 'law-02', 3: 'law-03', 4: 'law-04', 5: 'law-05', 6: 'law-06', 7: 'law-07', 8: 'law-08', 9: 'law-09', 10: 'law-10', 11: 'law-11', 12: 'law-13', 13: 'law-14', 14: 'law-15', 15: 'law-12' }
export const LAW_EXTRA = { id: 'law-16', name: 'Balance Portion and Amendment Video (faculty)' }

export interface LawParse {
  lectures: ParsedLecture[]
  /** Items the list called lectures but I did not load, and why. */
  skipped: string[]
  /** The count the platform printed next to each chapter, by app chapter id. */
  headerCounts: Record<string, number>
}
export function parseLaw(raw: string = lawRaw): LawParse {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
  const lectures: ParsedLecture[] = []
  const skipped: string[] = []
  const headerCounts: Record<string, number> = {}
  let chapterId: string | null = null
  let skipping = false
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    const ch = /^Chapter (\d+) (?!-)(.+)$/.exec(l)
    if (ch) {
      chapterId = LAW_CHAPTER[Number(ch[1])] ?? null
      skipping = false
      if (!chapterId) throw new Error(`Unmapped Law chapter: ${l}`)
    } else if (/^16\.\s/.test(l)) {
      chapterId = LAW_EXTRA.id
      skipping = false
    } else if (/^Special Session$/i.test(l)) {
      chapterId = null
      skipping = true
    } else if (l.startsWith('·')) {
      const count = /^·\s*(\d+)$/.exec(l)
      if (count && !skipping && chapterId && lines[i - 1] && !lines[i - 1].startsWith('·') && (/^Chapter \d+ (?!-)/.test(lines[i - 1]) || /^16\.\s/.test(lines[i - 1]))) headerCounts[chapterId] = Number(count[1])
    } else {
      // a lecture title; the next line is its duration when it has one
      const dur = lines[i + 1] && isDurationLine(lines[i + 1]) ? lines[i + 1] : ''
      if (skipping) {
        skipped.push(l)
        if (dur) i++
        continue
      }
      if (!chapterId) continue
      lectures.push({ chapterId, title: l, minutes: parseDuration(dur), pct: pctOf(dur) })
      if (dur) i++
    }
  }
  return { lectures, skipped, headerCounts }
}

/**
 * Direct Tax: which app chapter each "Day" belongs to, from the faculty's topic label.
 * Tax rates and notes sit in Basic Concepts; AMT and the new tax regime in the final computation chapter.
 */
export function dtChapter(topic: string): string | null {
  const t = topic.toLowerCase().trim()
  if (t.startsWith('basic')) return 'dt-01'
  if (t.includes('residential status')) return 'dt-02'
  if (t.includes('salary')) return 'dt-03'
  if (t.includes('house property')) return 'dt-04'
  if (t.startsWith('pgbp')) return 'dt-05' // "PGBP And Clubbing of Income" starts with PGBP, so it is filed there
  if (t.includes('capital gain')) return 'dt-06'
  if (t.includes('other sources')) return 'dt-07'
  if (t.includes('clubbing')) return 'dt-08'
  if (t.includes('setoff') || t.includes('set off') || t.includes('set-off')) return 'dt-09'
  if (t.includes('deduction')) return 'dt-10'
  if (t.startsWith('return')) return 'dt-12' // "Return File And Adv Tax" starts with Return, so it is filed there
  if (t.includes('adv tax') || t.includes('tds')) return 'dt-11'
  if (t.includes('alternat') || t.includes('minimum tax')) return 'dt-13'
  return null
}

export function parseDT(raw: string = dtRaw): ParsedLecture[] {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
  const out: ParsedLecture[] = []
  for (let i = 0; i < lines.length; i++) {
    const m = /^day\s*-\s*(\d+)\s*(?:part\s*-?\s*\d+\s*)?(.+)$/i.exec(lines[i])
    if (!m) continue
    const dur = lines[i + 1] && isDurationLine(lines[i + 1]) ? lines[i + 1] : ''
    const chapterId = dtChapter(m[2])
    if (!chapterId) throw new Error(`Unmapped Direct Tax topic: ${lines[i]}`)
    out.push({ chapterId, title: lines[i], minutes: parseDuration(dur), pct: pctOf(dur) })
    if (dur) i++
  }
  return out
}

export type ListKey = 'aa' | 'law' | 'dt'
export const LIST_INFO: Record<ListKey, { subjectId: string; label: string; faculty: string }> = {
  aa: { subjectId: 'aa', label: 'Advanced Accounting', faculty: 'Akash Kandoi' },
  law: { subjectId: 'law', label: 'Corporate and Other Laws', faculty: 'Shubham Singhal' },
  dt: { subjectId: 'dt', label: 'Income Tax (Direct Tax)', faculty: 'BB Sir' },
}

export function parsedFor(key: ListKey) {
  if (key === 'aa') return { lectures: parseAA(), skipped: [] as string[], headerCounts: {} as Record<string, number> }
  if (key === 'dt') return { lectures: parseDT(), skipped: [] as string[], headerCounts: {} as Record<string, number> }
  return parseLaw()
}

export interface ImportPlan {
  chapters: Chapter[] // chapters to save (updated or newly created)
  lectures: number
  minutes: number
  created: string[]
  missing: string[] // chapter ids the list refers to that this account no longer has
  skipped: string[]
  mismatches: { chapterId: string; name: string; listed: number; platform: number }[]
  untouched: string[] // chapter names of the subject that the list has no lectures for
  subjects: Subject[] // subjects to update alongside (GST waits for Direct Tax)
  notes: string[]
}

/** Merge a faculty lecture list into the chapters. Re-running keeps what was already ticked (matched by title). */
export function planListImport(data: Data, key: ListKey): ImportPlan {
  const info = LIST_INFO[key]
  const parsed = parsedFor(key)
  const byChapter = new Map<string, ParsedLecture[]>()
  for (const l of parsed.lectures) byChapter.set(l.chapterId, [...(byChapter.get(l.chapterId) ?? []), l])
  const subjectChapters = data.chapters.filter((c) => c.subjectId === info.subjectId)
  const plan: ImportPlan = { chapters: [], lectures: 0, minutes: 0, created: [], missing: [], skipped: parsed.skipped, mismatches: [], untouched: [], subjects: [], notes: [] }
  let nextOrder = Math.max(-1, ...subjectChapters.map((c) => c.order)) + 1
  for (const [chapterId, items] of byChapter) {
    let chapter = data.chapters.find((c) => c.id === chapterId)
    if (!chapter) {
      if (chapterId === LAW_EXTRA.id) {
        chapter = newChapter(info.subjectId, LAW_EXTRA.name, nextOrder++, chapterId)
        plan.created.push(chapter.name)
      } else {
        plan.missing.push(chapterId)
        continue
      }
    }
    const old = new Map((chapter.lectures ?? []).map((l) => [l.title, l]))
    const lectures: Lecture[] = items.map((it, i) => {
      const prev = old.get(it.title)
      return { id: `${chapterId}-${i + 1}`, title: it.title, minutes: it.minutes, done: prev?.done ?? false, pct: prev ? prev.pct : it.pct, doneAt: prev?.doneAt }
    })
    plan.chapters.push({ ...chapter, lectures, totalLectures: lectures.length })
    plan.lectures += lectures.length
    plan.minutes += lectures.reduce((a, l) => a + l.minutes, 0)
    const platform = parsed.headerCounts[chapterId]
    if (platform != null && platform !== lectures.length) plan.mismatches.push({ chapterId, name: chapter.name, listed: lectures.length, platform })
  }
  if (key === 'dt') {
    const gst = data.subjects.find((s) => s.id === 'gst')
    if (gst && !gst.startsAfter) {
      plan.subjects.push({ ...gst, startsAfter: 'dt' })
      plan.notes.push('GST is now set to start after Direct Tax is finished.')
    }
  }
  plan.untouched = subjectChapters.filter((c) => !byChapter.has(c.id)).sort((a, b) => a.order - b.order).map((c) => c.name)
  return plan
}
