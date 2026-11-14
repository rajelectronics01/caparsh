import { uid } from './dates'
import { chapterStats } from './analytics'
import { defaultSettings, emptyRevisions } from './seed'
import { ACTIVITIES, TEST_TYPES, type Data, type Session, type TestRecord } from './types'

function download(name: string, blob: Blob) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
const stamp = () => new Date().toISOString().slice(0, 10)

// ---------- full backup (lossless)
export function exportBackup(data: Data) {
  const payload = { app: 'parsh-ca-tracker', version: 1, exportedAt: new Date().toISOString(), data }
  download(`parsh-ca-backup-${stamp()}.json`, new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' }))
}

export function parseBackup(text: string): Data {
  let p: { app?: string; data?: Partial<Data> }
  try {
    p = JSON.parse(text)
  } catch {
    throw new Error('This file is not valid JSON.')
  }
  if (p?.app !== 'parsh-ca-tracker' || !p.data) throw new Error('This is not a Parsh CA Tracker backup file.')
  const d = p.data
  const arr = <T>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]).filter((r) => r && typeof (r as { id?: unknown }).id === 'string') : [])
  const out: Data = {
    settings: { ...defaultSettings(), ...(d.settings ?? {}), id: 'settings' },
    subjects: arr(d.subjects),
    chapters: arr<Data['chapters'][number]>(d.chapters).map((c) => ({ ...c, lectureMarks: c.lectureMarks ?? [], revisions: c.revisions?.length === 3 ? c.revisions : emptyRevisions() })),
    sessions: arr(d.sessions),
    days: arr(d.days),
    tests: arr(d.tests),
    plans: arr(d.plans),
    snapshots: arr(d.snapshots),
  }
  if (!out.subjects.length) throw new Error('The backup contains no subjects, so it was not restored.')
  return out
}

// ---------- Excel / CSV
const sessionRows = (data: Data) => {
  const sub = new Map(data.subjects.map((s) => [s.id, s.name]))
  const ch = new Map(data.chapters.map((c) => [c.id, c.name]))
  return [...data.sessions]
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? ''))
    .map((s) => ({
      id: s.id,
      date: s.date,
      subjectId: s.subjectId,
      subject: sub.get(s.subjectId) ?? '',
      chapterId: s.chapterId ?? '',
      chapter: ch.get(s.chapterId ?? '') ?? '',
      activity: s.activity,
      start: s.start ?? '',
      end: s.end ?? '',
      durationMin: s.durationMin,
      topic: s.topic ?? '',
      lecturesCompleted: s.lecturesCompleted ?? '',
      qAttempted: s.qAttempted ?? '',
      qCorrect: s.qCorrect ?? '',
      notes: s.notes ?? '',
      status: s.status,
    }))
}

export async function exportExcel(data: Data) {
  const XLSX = await import('xlsx')
  const sub = new Map(data.subjects.map((s) => [s.id, s.name]))
  const ch = new Map(data.chapters.map((c) => [c.id, c.name]))
  const wb = XLSX.utils.book_new()
  const add = (name: string, rows: Record<string, unknown>[], header: string[]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows, { header }), name)
  add('Sessions', sessionRows(data), ['id', 'date', 'subjectId', 'subject', 'chapterId', 'chapter', 'activity', 'start', 'end', 'durationMin', 'topic', 'lecturesCompleted', 'qAttempted', 'qCorrect', 'notes', 'status'])
  add(
    'Tests',
    data.tests.map((t) => ({ ...t, subject: sub.get(t.subjectId) ?? '', chapter: ch.get(t.chapterId ?? '') ?? '', chapterId: t.chapterId ?? '', remarks: t.remarks ?? '' })),
    ['id', 'date', 'subjectId', 'subject', 'chapterId', 'chapter', 'type', 'totalMarks', 'marks', 'attempted', 'correct', 'incorrect', 'timeMin', 'remarks'],
  )
  add(
    'Chapters',
    chapterStats(data)
      .sort((a, b) => a.chapter.subjectId.localeCompare(b.chapter.subjectId) || a.chapter.order - b.chapter.order)
      .map((c) => ({
        subject: sub.get(c.chapter.subjectId) ?? '',
        chapter: c.chapter.name,
        totalLectures: c.chapter.totalLectures,
        lecturesDone: c.lecturesDone,
        questionTarget: c.chapter.questionTarget,
        questionsPractised: c.questions,
        answersChecked: c.graded,
        answersCorrect: c.correct,
        rtpMtpPyqDone: c.chapter.rtpDone ? 'Yes' : 'No',
        revision1: c.chapter.revisions[0].date ?? (c.chapter.revisions[0].done ? 'Done' : ''),
        revision2: c.chapter.revisions[1].date ?? (c.chapter.revisions[1].done ? 'Done' : ''),
        revision3: c.chapter.revisions[2].date ?? (c.chapter.revisions[2].done ? 'Done' : ''),
        nextRevision: c.chapter.nextRevisionDate ?? '',
        status: c.status,
        progressPct: Math.round(c.progress * 10) / 10,
      })),
    [],
  )
  add('Subjects', data.subjects.map((s) => ({ id: s.id, name: s.name, paper: s.paper, group: s.group, faculty: s.faculty, weeklyTargetHours: data.settings.weeklyTargets[s.id] ?? '', lectureTargetDate: s.lectureTargetDate ?? '' })), [])
  add('Planner', data.plans.map((p) => ({ date: p.date, kind: p.kind, title: p.title, subject: sub.get(p.subjectId ?? '') ?? '', start: p.start ?? '', end: p.end ?? '', plannedMin: p.plannedMin, done: p.done ? 'Yes' : 'No' })), [])
  add('Days', data.days.map((d) => ({ date: d.id, college: d.college ? 'Yes' : 'No', office: d.office ? 'Yes' : 'No', semesterExam: d.semExam ? 'Yes' : 'No', dayType: d.dayType })), [])
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  download(`parsh-ca-tracker-${stamp()}.xlsx`, new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
}

export async function exportSessionsCSV(data: Data) {
  const XLSX = await import('xlsx')
  const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(sessionRows(data)))
  download(`parsh-ca-sessions-${stamp()}.csv`, new Blob(['﻿', csv], { type: 'text/csv' }))
}

type Raw = Record<string, unknown>
const str = (v: unknown) => (v == null ? '' : String(v).trim())
const n = (v: unknown) => {
  const x = Number(v)
  return Number.isFinite(x) ? x : NaN
}
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)
const isTime = (s: string) => /^\d{2}:\d{2}$/.test(s)

/** Read Sessions/Tests back from a workbook or CSV exported by this app. Rows that fail validation are skipped and counted. */
export async function importSpreadsheet(file: File, data: Data) {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', raw: true })
  const subjects = new Set(data.subjects.map((s) => s.id))
  const chapters = new Set(data.chapters.map((c) => c.id))
  const sessions: Session[] = []
  const tests: TestRecord[] = []
  let skipped = 0
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<Raw>(wb.Sheets[name], { defval: '', raw: false })
    if (!rows.length) continue
    const cols = Object.keys(rows[0])
    if (cols.includes('activity') && cols.includes('durationMin')) {
      for (const r of rows) {
        const dur = n(r.durationMin)
        const act = str(r.activity)
        const qa = str(r.qAttempted) === '' ? undefined : n(r.qAttempted)
        const qc = str(r.qCorrect) === '' ? undefined : n(r.qCorrect)
        const ok = isDate(str(r.date)) && subjects.has(str(r.subjectId)) && ACTIVITIES.some((a) => a.id === act) && dur > 0 && dur <= 960 && (qa == null || qa >= 0) && (qc == null || (qa != null && qc >= 0 && qc <= qa))
        if (!ok) {
          skipped++
          continue
        }
        const timed = isTime(str(r.start)) && isTime(str(r.end))
        sessions.push({
          id: str(r.id) || uid(),
          date: str(r.date),
          subjectId: str(r.subjectId),
          chapterId: chapters.has(str(r.chapterId)) ? str(r.chapterId) : undefined,
          activity: act as Session['activity'],
          start: timed ? str(r.start) : undefined,
          end: timed ? str(r.end) : undefined,
          durationMin: Math.round(dur),
          topic: str(r.topic) || undefined,
          lecturesCompleted: str(r.lecturesCompleted) === '' || !(n(r.lecturesCompleted) >= 0) ? undefined : n(r.lecturesCompleted),
          qAttempted: qa || undefined,
          qCorrect: qa ? qc : undefined,
          notes: str(r.notes) || undefined,
          status: str(r.status) === 'partial' ? 'partial' : 'completed',
        })
      }
    } else if (cols.includes('totalMarks') && cols.includes('type')) {
      for (const r of rows) {
        const v = { total: n(r.totalMarks) || 0, marks: n(r.marks) || 0, att: n(r.attempted) || 0, cor: n(r.correct) || 0, inc: n(r.incorrect) || 0, time: n(r.timeMin) || 0 }
        const ok = isDate(str(r.date)) && subjects.has(str(r.subjectId)) && TEST_TYPES.includes(str(r.type) as TestRecord['type']) && Object.values(v).every((x) => x >= 0) && v.marks <= v.total && v.cor + v.inc <= v.att && (v.total > 0 || v.att > 0)
        if (!ok) {
          skipped++
          continue
        }
        tests.push({ id: str(r.id) || uid(), date: str(r.date), subjectId: str(r.subjectId), chapterId: chapters.has(str(r.chapterId)) ? str(r.chapterId) : undefined, type: str(r.type) as TestRecord['type'], totalMarks: v.total, marks: v.marks, attempted: v.att, correct: v.cor, incorrect: v.inc, timeMin: v.time, remarks: str(r.remarks) || undefined })
      }
    }
  }
  return { sessions, tests, skipped }
}
