import { useMemo, useState } from 'react'
import { markLecture, tickLectures } from '../lib/actions'
import { lectureUnits, unitDone, watchOrder } from '../lib/lectureLists'
import { LecturePicker, lectureKey, remainingMinutes } from './LecturePicker'
import { overlapping } from '../lib/analytics'
import { durationBetween, fmtHM, minToTime, today, uid } from '../lib/dates'
import { useStore } from '../lib/store'
import type { Activity, Session } from '../lib/types'
import { useSubjects } from './SessionForm'
import { Modal, cx, useToast } from './ui'

const ACTS: { id: Activity; label: string }[] = [
  { id: 'lecture', label: 'Lecture' },
  { id: 'self', label: 'Self-study' },
]
const DURS = [30, 45, 60, 90, 120, 150, 180]

const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <div>
    <div className="mb-2 flex items-center gap-2">
      <span className="tnum grid size-6 place-items-center border-2 border-ink text-xs font-bold text-[var(--on-color)]" style={{ background: `var(--p${n + 1})` }}>
        {n}
      </span>
      <span className="text-xs font-bold uppercase tracking-wider">{title}</span>
    </div>
    {children}
  </div>
)

function Stepper({ value, onChange, step = 1, label }: { value: number; onChange: (v: number) => void; step?: number; label: string }) {
  const b = 'press grid size-11 place-items-center border-2 border-ink bg-surface text-xl font-bold'
  return (
    <div className="flex items-center justify-between gap-3 border-2 border-ink bg-surface-2 px-3 py-2">
      <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" aria-label={`Less: ${label}`} className={b} onClick={() => onChange(Math.max(0, value - step))}>
          −
        </button>
        <span className="tnum min-w-10 text-center text-xl font-bold" aria-live="polite">
          {value}
        </span>
        <button type="button" aria-label={`More: ${label}`} className={b} onClick={() => onChange(value + step)}>
          +
        </button>
      </div>
    </div>
  )
}

/** Tap-first logging: subject, activity, duration, done. The full form is one tap away for anything unusual. */
/** What the log opens with. `lectureKeys` pre-selects lectures ("chapterId|lectureId"). */
export type QuickInit = Partial<Session> & { lectureKeys?: string[] }

export function QuickLog({ initial, onClose, onDetails }: { initial?: QuickInit; onClose: () => void; onDetails: (s: Partial<Session>) => void }) {
  const { data, sum, put } = useStore()
  const { subjects, chaptersOf } = useSubjects()
  const toast = useToast()
  const last = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('pct.quick') ?? '{}') as { subjectId?: string; activity?: Activity; min?: number }
    } catch {
      return {}
    }
  }, [])
  const fromTimer = !!(initial?.start && initial?.end)
  const [date, setDate] = useState(initial?.date ?? today())
  const [from, setFrom] = useState(initial?.start ?? '')
  const [to, setTo] = useState(initial?.end ?? '')
  const [note, setNote] = useState('')
  // Typed clock times win over the tapped duration.
  const timed = !!(from && to)
  const [subjectId, setSubject] = useState(initial?.subjectId ?? (subjects.some((s) => s.id === last.subjectId) ? last.subjectId! : (subjects[0]?.id ?? '')))
  const [activity, setActivity] = useState<Activity>(initial?.activity ?? (last.activity === 'self' ? 'self' : 'lecture'))
  // Lecture list: tick which lectures this session covered. Starts with the next one selected.
  const remainingFor = (sid: string) => watchOrder(data.chapters.filter((c) => c.subjectId === sid)).filter((o) => !o.lecture.done)
  // The default is a whole lecture: every part of the next one still to watch (Advanced Accounting lectures have two or three parts).
  const defaultPick = (sid: string) => {
    const unit = lectureUnits(data.chapters.filter((c) => c.subjectId === sid)).find((u) => !unitDone(u))
    return unit ? unit.parts.filter((p) => !p.lecture.done).map(lectureKey) : []
  }
  const clampMin = (m: number) => Math.max(5, Math.min(960, m))
  const startsSelf = initial?.activity === 'self' || (initial?.activity == null && last.activity === 'self')
  const startPick = startsSelf ? [] : initial?.lectureKeys?.length ? initial.lectureKeys : defaultPick(subjectId)
  const startPickMin = Math.round(remainingFor(subjectId).filter((o) => startPick.includes(lectureKey(o))).reduce((a, o) => a + remainingMinutes(o), 0))
  const [tapMin, setMinRaw] = useState(initial?.durationMin ?? (startPickMin > 0 ? clampMin(startPickMin) : (last.min ?? 60)))
  // Once you set the time yourself, ticking lectures stops overwriting it.
  const [durTouched, setDurTouched] = useState(!!initial?.durationMin)
  const setMin = (m: number) => (setDurTouched(true), setMinRaw(m))
  const min = timed ? durationBetween(from, to) : tapMin
  // Default to the chapter being worked on: the first one in this subject that is not finished.
  const auto = (sid: string) =>
    watchOrder(data.chapters.filter((c) => c.subjectId === sid)).find((o) => !o.lecture.done)?.chapter.id ??
    sum.cs.filter((c) => c.chapter.subjectId === sid && !c.done).sort((a, b) => a.chapter.order - b.chapter.order)[0]?.chapter.id ?? ''
  const [chapterId, setChapter] = useState(initial?.chapterId ?? auto(subjectId))
  const [lec, setLec] = useState(activity === 'lecture' ? 1 : 0)
  const isLecture = activity === 'lecture'
  const nextLecture = data.chapters.find((c) => c.id === chapterId)?.lectures?.find((l) => !l.done)

  const [picked, setPicked] = useState<string[]>(startPick)
  const remaining = remainingFor(subjectId)
  const hasList = data.chapters.some((c) => c.subjectId === subjectId && c.lectures?.length)
  const usePicker = isLecture && hasList
  const pickedSet = new Set(picked)
  const pickedLectures = remaining.filter((o) => pickedSet.has(lectureKey(o)))
  const pickedMinutes = Math.round(pickedLectures.reduce((a, o) => a + remainingMinutes(o), 0))
  // The picked lectures' length is the starting duration, unless a time was typed, tapped, timed or passed in.
  const applyPicked = (next: string[], sid = subjectId, force = false) => {
    setPicked(next)
    const rem = remainingFor(sid).filter((o) => next.includes(lectureKey(o)))
    const m = Math.round(rem.reduce((a, o) => a + remainingMinutes(o), 0))
    if ((force || !durTouched) && !timed && m > 0) setMinRaw(clampMin(m))
    const firstChap = rem[0]?.chapter.id
    if (firstChap) setChapter(firstChap)
  }
  // Keep the picks in teaching order so the session's chapter is the earliest lecture's.
  const inOrder = (keys: string[]) => {
    const order = new Map(remaining.map((r, i) => [lectureKey(r), i]))
    return [...new Set(keys)].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
  }
  const togglePick = (o: (typeof remaining)[number]) => {
    const k = lectureKey(o)
    applyPicked(inOrder(pickedSet.has(k) ? picked.filter((x) => x !== k) : [...picked, k]))
  }
  const toggleMany = (items: typeof remaining, on: boolean) => {
    const keys = items.map(lectureKey)
    applyPicked(inOrder(on ? [...picked, ...keys] : picked.filter((x) => !keys.includes(x))))
  }

  const build = (): Session => {
    let start = timed ? from : undefined
    let end = timed ? to : undefined
    if (!timed && date === today()) {
      // Assume the session just ended; fall back to an untimed entry if that would overlap another one.
      const now = new Date()
      const e = now.getHours() * 60 + now.getMinutes()
      if (e - min >= 0) {
        const cand = { id: '', date, start: minToTime(e - min), end: minToTime(e) }
        if (!overlapping(data.sessions, cand).length) {
          start = cand.start
          end = cand.end
        }
      }
    }
    return {
      id: uid(),
      date,
      subjectId,
      chapterId: chapterId || undefined,
      activity,
      start,
      end,
      durationMin: min,
      topic: note.trim() || undefined,
      lecturesCompleted: isLecture ? (usePicker ? pickedLectures.length : lec) : undefined,
      status: 'completed',
    }
  }
  const save = () => {
    if (!subjectId) return
    if (!date) return toast('Pick the date.', 'bad')
    if (!!from !== !!to) return toast('Type both a start and an end time, or clear both.', 'bad')
    if (!(min > 0) || min > 960) return toast('Duration must be between 1 minute and 16 hours.', 'bad')
    const s = build()
    const clash = timed ? overlapping(data.sessions, s) : []
    if (clash.length) return toast(`That overlaps a session already logged at ${clash[0].start}–${clash[0].end}.`, 'bad')
    put('sessions', s)
    if (usePicker) {
      // Tick exactly the lectures that were selected.
      const byChapter = new Map<string, string[]>()
      for (const o of pickedLectures) byChapter.set(o.chapter.id, [...(byChapter.get(o.chapter.id) ?? []), o.lecture.id])
      for (const [cid, ids] of byChapter) {
        const ch = data.chapters.find((c) => c.id === cid)
        if (ch) put('chapters', tickLectures(ch, ids, s.date))
      }
    } else {
      // Without a list, finished lectures are counted on the chapter (or the next ones ticked if it has one).
      const chap = data.chapters.find((c) => c.id === s.chapterId)
      if (s.activity === 'lecture' && chap?.lectures?.length && lec > 0) put('chapters', markLecture(chap, Math.round(lec)))
    }
    localStorage.setItem('pct.quick', JSON.stringify({ subjectId, activity, min: tapMin }))
    toast(`Logged ${fmtHM(min)} of ${subjects.find((x) => x.id === subjectId)?.short}`)
    onClose()
  }
  const chip = (on: boolean, color = 'var(--p2)') => ({ className: 'press min-h-11 border-2 border-ink px-3 text-[13px] font-bold uppercase tracking-wide', style: on ? { background: color, color: 'var(--on-color)' } : { background: 'var(--surface)', color: 'var(--ink)' } })

  return (
    <Modal title="Log study" onClose={onClose} wide>
      <div className="space-y-5">
        <Step n={1} title="Subject">
          <div className="grid grid-cols-4 gap-2">
            {subjects.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={subjectId === s.id}
                onClick={() => {
                  setSubject(s.id)
                  setChapter(auto(s.id))
                  setDurTouched(false)
                  if (isLecture) applyPicked(defaultPick(s.id), s.id, true)
                  else setPicked([])
                }}
                className={cx('press flex min-h-14 flex-col items-stretch border-2 border-ink text-[13px] font-bold uppercase', subjectId === s.id ? 'bg-ink text-bg' : 'text-ink')}
                style={subjectId === s.id ? undefined : { background: `color-mix(in srgb, var(--s${s.slot}) 24%, var(--surface))` }}
              >
                <span className="h-3" style={{ background: `var(--s${s.slot})` }} />
                <span className="flex flex-1 items-center justify-center px-1">{s.short}</span>
              </button>
            ))}
          </div>
          {!usePicker && (
          <select aria-label="Chapter" className="inp mt-2 text-sm" value={chapterId} onChange={(e) => setChapter(e.target.value)}>
            <option value="">No specific chapter</option>
            {chaptersOf(subjectId).map((c) => (
              <option key={c.id} value={c.id}>
                {c.order + 1}. {c.name}
              </option>
            ))}
          </select>
          )}
        </Step>
        <Step n={2} title="What did you do">
          <div className="flex flex-wrap gap-2">
            {ACTS.map((a) => (
              <button key={a.id} type="button" aria-pressed={activity === a.id} {...chip(activity === a.id)} onClick={() => {
                  setActivity(a.id)
                  setLec(a.id === 'lecture' ? Math.max(1, lec) : 0)
                  if (a.id === 'lecture') applyPicked(defaultPick(subjectId))
                  else setPicked([])
                }}>
                {a.label}
              </button>
            ))}
          </div>
        </Step>
        {usePicker && (
          <Step n={3} title={`Which lectures? ${pickedLectures.length ? `${pickedLectures.length} selected` : 'none selected'}`}>
            <LecturePicker remaining={remaining} picked={pickedSet} onToggle={togglePick} onToggleMany={toggleMany} />
            {pickedLectures.length > 0 && pickedMinutes > 0 && !timed && !durTouched && <p className="mt-1 text-xs text-ink-2">Time starts at the length of the selected lectures. Change it below if you paused or rewatched.</p>}
          </Step>
        )}
        <Step n={usePicker ? 4 : 3} title={fromTimer ? 'How long · from the timer' : timed ? 'How long · from the times you typed' : 'How long'}>
          {!timed && (
            <div className="mb-2 flex flex-wrap gap-2">
              {DURS.map((d) => (
                <button key={d} type="button" aria-pressed={min === d} {...chip(min === d, 'var(--p3)')} onClick={() => setMin(d)}>
                  {fmtHM(d)}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between gap-3 border-2 border-ink bg-hi px-3 py-2 text-hi-ink">
            {!timed && (
              <button type="button" aria-label="15 minutes less" className="press grid size-11 place-items-center border-2 border-ink bg-surface text-xl font-bold text-ink" onClick={() => setMin(Math.max(5, tapMin - 15))}>
                −
              </button>
            )}
            <span className="tnum flex-1 text-center text-3xl font-bold" aria-live="polite">
              {fmtHM(min)}
            </span>
            {!timed && (
              <button type="button" aria-label="15 minutes more" className="press grid size-11 place-items-center border-2 border-ink bg-surface text-xl font-bold text-ink" onClick={() => setMin(Math.min(960, tapMin + 15))}>
                +
              </button>
            )}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-2">Or type minutes</span>
              <input type="number" min="1" max="960" inputMode="numeric" aria-label="Minutes studied" className="inp tnum" disabled={timed} value={timed ? min : tapMin || ''} onChange={(e) => setMin(Math.max(0, Math.min(960, Math.round(Number(e.target.value) || 0))))} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-2">Date</span>
              <input type="date" aria-label="Date" className="inp tnum" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-2">From (optional)</span>
              <input type="time" aria-label="Start time" className="inp tnum" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-2">To (optional)</span>
              <input type="time" aria-label="End time" className="inp tnum" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
        </Step>
        {isLecture && !usePicker && <Stepper label="Lectures finished" value={lec} onChange={setLec} />}
        {isLecture && !usePicker && nextLecture && (
          <p className="-mt-3 text-xs text-ink-2">
            {lec > 0 ? 'Ticks off' : 'Next in your list'}: <span className="font-bold">{nextLecture.title}</span>
            {lec > 1 ? ` and ${lec - 1} more` : ''}
          </p>
        )}
        <input aria-label="Topic or note" className="inp" placeholder="Topic or note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <button type="button" onClick={save} className="press min-h-14 flex-1 border-2 border-ink bg-hi text-lg font-bold uppercase tracking-wide text-hi-ink">
            Log it
          </button>
          <button type="button" onClick={() => onDetails({ ...build(), id: undefined, ...(timed ? {} : { start: undefined, end: undefined }) })} className="press min-h-12 border-2 border-ink bg-surface px-4 text-[13px] font-bold uppercase tracking-wide">
            More details
          </button>
        </div>
      </div>
    </Modal>
  )
}
