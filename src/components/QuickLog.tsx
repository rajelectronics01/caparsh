import { useMemo, useState } from 'react'
import { overlapping } from '../lib/analytics'
import { durationBetween, fmtHM, minToTime, today, uid } from '../lib/dates'
import { useStore } from '../lib/store'
import type { Activity, Session } from '../lib/types'
import { useSubjects } from './SessionForm'
import { Modal, cx, useToast } from './ui'

const ACTS: { id: Activity; label: string }[] = [
  { id: 'lecture', label: 'Lecture' },
  { id: 'self', label: 'Self-study' },
  { id: 'practice', label: 'Practice' },
  { id: 'revision', label: 'Revision' },
  { id: 'rtp', label: 'RTP / PYQ' },
  { id: 'mock', label: 'Mock test' },
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
export function QuickLog({ initial, onClose, onDetails }: { initial?: Partial<Session>; onClose: () => void; onDetails: (s: Partial<Session>) => void }) {
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
  const timed = !!(initial?.start && initial?.end)
  const [subjectId, setSubject] = useState(initial?.subjectId ?? (subjects.some((s) => s.id === last.subjectId) ? last.subjectId! : (subjects[0]?.id ?? '')))
  const [activity, setActivity] = useState<Activity>(initial?.activity ?? last.activity ?? 'lecture')
  const [min, setMin] = useState(timed ? durationBetween(initial!.start!, initial!.end!) : (initial?.durationMin ?? last.min ?? 60))
  // Default to the chapter being worked on: the first one in this subject that is not finished.
  const auto = (sid: string) => sum.cs.filter((c) => c.chapter.subjectId === sid && c.status !== 'Completed').sort((a, b) => a.chapter.order - b.chapter.order)[0]?.chapter.id ?? ''
  const [chapterId, setChapter] = useState(initial?.chapterId ?? auto(subjectId))
  const [lec, setLec] = useState(activity === 'lecture' ? 1 : 0)
  const [qa, setQa] = useState(0)
  const [qc, setQc] = useState(0)
  const isLecture = activity === 'lecture'
  const hasQ = activity === 'practice' || activity === 'rtp' || activity === 'mock'

  const build = (): Session => {
    const date = initial?.date ?? today()
    let start = initial?.start
    let end = initial?.end
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
      lecturesCompleted: isLecture ? lec : undefined,
      qAttempted: hasQ && qa > 0 ? qa : undefined,
      qCorrect: hasQ && qa > 0 ? Math.min(qc, qa) : undefined,
      status: 'completed',
    }
  }
  const save = () => {
    if (!subjectId || min <= 0) return
    const s = build()
    if (timed && overlapping(data.sessions, s).length) return toast('That time overlaps another session. Use “More details” to adjust it.', 'bad')
    put('sessions', s)
    localStorage.setItem('pct.quick', JSON.stringify({ subjectId, activity, min }))
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
                onClick={() => (setSubject(s.id), setChapter(auto(s.id)))}
                className={cx('press flex min-h-14 flex-col items-stretch border-2 border-ink text-[13px] font-bold uppercase', subjectId === s.id ? 'bg-ink text-bg' : 'text-ink')}
                style={subjectId === s.id ? undefined : { background: `color-mix(in srgb, var(--s${s.slot}) 24%, var(--surface))` }}
              >
                <span className="h-3" style={{ background: `var(--s${s.slot})` }} />
                <span className="flex flex-1 items-center justify-center px-1">{s.short}</span>
              </button>
            ))}
          </div>
          <select aria-label="Chapter" className="inp mt-2 text-sm" value={chapterId} onChange={(e) => setChapter(e.target.value)}>
            <option value="">No specific chapter</option>
            {chaptersOf(subjectId).map((c) => (
              <option key={c.id} value={c.id}>
                {c.order + 1}. {c.name}
              </option>
            ))}
          </select>
        </Step>
        <Step n={2} title="What did you do">
          <div className="flex flex-wrap gap-2">
            {ACTS.map((a) => (
              <button key={a.id} type="button" aria-pressed={activity === a.id} {...chip(activity === a.id)} onClick={() => (setActivity(a.id), setLec(a.id === 'lecture' ? Math.max(1, lec) : 0))}>
                {a.label}
              </button>
            ))}
          </div>
        </Step>
        <Step n={3} title={timed ? `How long · ${initial!.start}–${initial!.end} from the timer` : 'How long'}>
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
              <button type="button" aria-label="15 minutes less" className="press grid size-11 place-items-center border-2 border-ink bg-surface text-xl font-bold text-ink" onClick={() => setMin(Math.max(5, min - 15))}>
                −
              </button>
            )}
            <span className="tnum flex-1 text-center text-3xl font-bold" aria-live="polite">
              {fmtHM(min)}
            </span>
            {!timed && (
              <button type="button" aria-label="15 minutes more" className="press grid size-11 place-items-center border-2 border-ink bg-surface text-xl font-bold text-ink" onClick={() => setMin(Math.min(960, min + 15))}>
                +
              </button>
            )}
          </div>
        </Step>
        {isLecture && <Stepper label="Lectures finished" value={lec} onChange={setLec} />}
        {hasQ && (
          <div className="grid gap-2 sm:grid-cols-2">
            <Stepper label="Questions tried" value={qa} onChange={setQa} step={5} />
            <Stepper label="Got right" value={Math.min(qc, qa)} onChange={(v) => setQc(Math.min(v, qa))} step={1} />
          </div>
        )}
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
