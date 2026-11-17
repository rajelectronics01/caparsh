import { useMemo, useState } from 'react'
import { overlapping } from '../lib/analytics'
import { durationBetween, fmtHM, today, uid } from '../lib/dates'
import { markLecture } from '../lib/actions'
import { useStore } from '../lib/store'
import { ACTIVITIES, LOG_ACTIVITIES, type Activity, type Session } from '../lib/types'
import { Button, Field, Modal, num, useToast } from './ui'

export function useSubjects() {
  const { data } = useStore()
  return useMemo(() => {
    const subjects = [...data.subjects].sort((a, b) => a.order - b.order)
    const chaptersOf = (sid?: string) => data.chapters.filter((c) => c.subjectId === sid).sort((a, b) => a.order - b.order)
    const subject = (id?: string) => data.subjects.find((s) => s.id === id)
    const chapter = (id?: string) => data.chapters.find((c) => c.id === id)
    return { subjects, chaptersOf, subject, chapter }
  }, [data.subjects, data.chapters])
}

export function SessionForm({ initial, onClose, lockActivity }: { initial?: Partial<Session>; onClose: () => void; lockActivity?: Activity[] }) {
  const { data, put } = useStore()
  const { subjects, chaptersOf } = useSubjects()
  const toast = useToast()
  const editing = !!initial?.id
  const [f, setF] = useState({
    date: initial?.date ?? today(),
    subjectId: initial?.subjectId ?? subjects[0]?.id ?? '',
    chapterId: initial?.chapterId ?? '',
    activity: (initial?.activity ?? lockActivity?.[0] ?? 'lecture') as Activity,
    start: initial?.start ?? '',
    end: initial?.end ?? '',
    manualMin: initial?.durationMin && !(initial.start && initial.end) ? String(initial.durationMin) : '',
    topic: initial?.topic ?? '',
    lecturesCompleted: initial?.lecturesCompleted != null ? String(initial.lecturesCompleted) : '',
    qAttempted: initial?.qAttempted != null ? String(initial.qAttempted) : '',
    qCorrect: initial?.qCorrect != null ? String(initial.qCorrect) : '',
    notes: initial?.notes ?? '',
    status: initial?.status ?? 'completed',
  })
  const [err, setErr] = useState('')
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }))
  const timed = !!(f.start && f.end)
  const duration = timed ? durationBetween(f.start, f.end) : Math.round(num(f.manualMin))
  const acts = lockActivity ? ACTIVITIES.filter((a) => lockActivity.includes(a.id)) : ACTIVITIES.filter((a) => LOG_ACTIVITIES.some((l) => l.id === a.id) || a.id === initial?.activity)
  const isLecture = f.activity === 'lecture'
  const hasQ = f.activity === 'practice' || f.activity === 'rtp' || f.activity === 'mock'

  const save = () => {
    if (!f.date) return setErr('Pick a date.')
    if (!f.subjectId) return setErr('Pick a subject.')
    if ((f.start && !f.end) || (!f.start && f.end)) return setErr('Enter both a start and an end time, or leave both empty and type the minutes.')
    if (!(duration > 0)) return setErr('Duration must be more than zero. Enter start and end times, or the minutes studied.')
    if (duration > 16 * 60) return setErr('A single session longer than 16 hours looks like a typo. Check the times.')
    const qa = Math.round(num(f.qAttempted))
    const qc = f.qCorrect === '' ? undefined : Math.round(num(f.qCorrect))
    if (qa < 0 || (qc ?? 0) < 0) return setErr('Question counts cannot be negative.')
    if (qc != null && qc > qa) return setErr('Correct answers cannot exceed questions attempted.')
    const s: Session = {
      id: initial?.id ?? uid(),
      date: f.date,
      subjectId: f.subjectId,
      chapterId: f.chapterId || undefined,
      activity: f.activity,
      start: timed ? f.start : undefined,
      end: timed ? f.end : undefined,
      durationMin: duration,
      topic: f.topic.trim() || undefined,
      lecturesCompleted: isLecture && f.lecturesCompleted !== '' ? Math.max(0, num(f.lecturesCompleted)) : undefined,
      qAttempted: hasQ && qa > 0 ? qa : undefined,
      qCorrect: hasQ && qa > 0 ? qc : undefined,
      notes: f.notes.trim() || undefined,
      status: f.status as Session['status'],
    }
    const clash = overlapping(data.sessions, s)
    if (clash.length) return setErr(`This overlaps another session on the same day (${clash[0].start}–${clash[0].end}). Overlapping sessions would double-count hours.`)
    put('sessions', s)
    const chap = data.chapters.find((c) => c.id === s.chapterId)
    if (!editing && s.activity === 'lecture' && chap?.lectures?.length && (s.lecturesCompleted ?? 0) > 0) put('chapters', markLecture(chap, Math.round(s.lecturesCompleted!)))
    toast(editing ? 'Session updated' : `Logged ${fmtHM(duration)}`)
    onClose()
  }

  return (
    <Modal title={editing ? 'Edit study session' : 'Log study session'} onClose={onClose} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date">
          <input type="date" className="inp" value={f.date} onChange={(e) => set({ date: e.target.value })} />
        </Field>
        <Field label="Activity">
          <select className="inp" value={f.activity} onChange={(e) => set({ activity: e.target.value as Activity })}>
            {acts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Subject">
          <select className="inp" value={f.subjectId} onChange={(e) => set({ subjectId: e.target.value, chapterId: '' })}>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Chapter">
          <select className="inp" value={f.chapterId} onChange={(e) => set({ chapterId: e.target.value })}>
            <option value="">No specific chapter</option>
            {chaptersOf(f.subjectId).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Start time">
          <input type="time" className="inp" value={f.start} onChange={(e) => set({ start: e.target.value })} />
        </Field>
        <Field label="End time">
          <input type="time" className="inp" value={f.end} onChange={(e) => set({ end: e.target.value })} />
        </Field>
        <Field label="Duration" hint={timed ? 'Calculated from the times above.' : 'No clock times? Type the minutes studied.'}>
          {timed ? <div className="inp tnum flex items-center bg-surface-2">{fmtHM(duration)}</div> : <input type="number" min="1" inputMode="numeric" placeholder="Minutes" className="inp" value={f.manualMin} onChange={(e) => set({ manualMin: e.target.value })} />}
        </Field>
        <Field label={isLecture ? 'Lecture number / topic covered' : 'Topic covered'}>
          <input className="inp" value={f.topic} onChange={(e) => set({ topic: e.target.value })} placeholder={isLecture ? 'e.g. Lecture 4 – AS 10' : ''} />
        </Field>
        {isLecture && (
          <Field label="Lectures finished in this session" hint="Counts towards the chapter's lecture progress. Use 0 for a part-watched lecture.">
            <input type="number" min="0" step="0.5" inputMode="decimal" className="inp" value={f.lecturesCompleted} onChange={(e) => set({ lecturesCompleted: e.target.value })} />
          </Field>
        )}
        {hasQ && (
          <>
            <Field label="Questions attempted">
              <input type="number" min="0" inputMode="numeric" className="inp" value={f.qAttempted} onChange={(e) => set({ qAttempted: e.target.value })} />
            </Field>
            <Field label="Answered correctly" hint="Leave empty if you did not check answers.">
              <input type="number" min="0" inputMode="numeric" className="inp" value={f.qCorrect} onChange={(e) => set({ qCorrect: e.target.value })} />
            </Field>
          </>
        )}
        <Field label="Completion status">
          <select className="inp" value={f.status} onChange={(e) => set({ status: e.target.value as Session['status'] })}>
            <option value="completed">Completed as intended</option>
            <option value="partial">Partly done</option>
          </select>
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <textarea className="inp" value={f.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </div>
      {err && (
        <p role="alert" className="mt-4 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
          {err}
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save}>
          {editing ? 'Save changes' : 'Log session'}
        </Button>
      </div>
    </Modal>
  )
}
