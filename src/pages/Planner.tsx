import { useState } from 'react'
import { SessionForm, useSubjects } from '../components/SessionForm'
import { Badge, Button, Card, Check, ConfirmButton, Dot, Field, Modal, num, PageHeader, Progress, cx } from '../components/ui'
import { isStudyPlan } from '../lib/analytics'
import { addDays, dow, durationBetween, fmtDate, fmtDay, fmtHM, fmtShort, rangeDays, timeToMin, today, weekStart } from '../lib/dates'
import { useStore } from '../lib/store'
import { PLAN_KINDS, type Activity, type DayInfo, type PlanItem, type PlanKind, type Session } from '../lib/types'

const kindLabel = (k: PlanKind) => PLAN_KINDS.find((x) => x.id === k)!.label

function PlanForm({ initial, onClose }: { initial: Partial<PlanItem>; onClose: () => void }) {
  const { data, put } = useStore()
  const { subjects, chaptersOf, chapter, subject } = useSubjects()
  const [f, setF] = useState({
    date: initial.date ?? today(),
    kind: (initial.kind ?? 'lecture') as PlanKind,
    subjectId: initial.subjectId ?? subjects[0]?.id ?? '',
    chapterId: initial.chapterId ?? '',
    title: initial.title ?? '',
    start: initial.start ?? '',
    end: initial.end ?? '',
    min: initial.plannedMin ? String(initial.plannedMin) : '',
    done: initial.done ?? false,
  })
  const [err, setErr] = useState('')
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }))
  const study = !!PLAN_KINDS.find((k) => k.id === f.kind)?.study
  const timed = !!(f.start && f.end)
  const minutes = timed ? durationBetween(f.start, f.end) : Math.round(num(f.min))
  const info = data.days.find((d) => d.id === f.date)
  const college = info ? info.college : data.settings.collegeDays.includes(dow(f.date))
  const clash = study && college && timed && timeToMin(f.start) < timeToMin(data.settings.homeBy) && timeToMin(f.end) > timeToMin(data.settings.collegeStart)
  const save = () => {
    if (!f.date) return setErr('Pick a date.')
    if (!(minutes > 0)) return setErr('Enter start and end times, or the planned minutes.')
    const auto = study ? `${subject(f.subjectId)?.short ?? ''}: ${chapter(f.chapterId)?.name ?? kindLabel(f.kind)}` : kindLabel(f.kind)
    put('plans', {
      id: initial.id ?? crypto.randomUUID(),
      date: f.date,
      kind: f.kind,
      subjectId: study ? f.subjectId : undefined,
      chapterId: study ? f.chapterId || undefined : undefined,
      title: f.title.trim() || auto,
      start: timed ? f.start : undefined,
      end: timed ? f.end : undefined,
      plannedMin: minutes,
      done: f.done,
      fromBacklog: initial.fromBacklog,
    })
    onClose()
  }
  return (
    <Modal title={initial.id ? 'Edit planned activity' : 'Plan an activity'} onClose={onClose} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date">
          <input type="date" className="inp" value={f.date} onChange={(e) => set({ date: e.target.value })} />
        </Field>
        <Field label="Type">
          <select className="inp" value={f.kind} onChange={(e) => set({ kind: e.target.value as PlanKind })}>
            {PLAN_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>
        {study && (
          <>
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
          </>
        )}
        <Field label="Title" hint="Optional. Left empty, it is named from the subject and chapter." className="sm:col-span-2">
          <input className="inp" value={f.title} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label="Start time">
          <input type="time" className="inp" value={f.start} onChange={(e) => set({ start: e.target.value })} />
        </Field>
        <Field label="End time">
          <input type="time" className="inp" value={f.end} onChange={(e) => set({ end: e.target.value })} />
        </Field>
        <Field label="Planned duration" hint={timed ? 'From the times above.' : 'Or just the minutes, with no fixed time.'}>
          {timed ? <div className="inp tnum flex items-center bg-surface-2">{fmtHM(minutes)}</div> : <input type="number" min="1" className="inp" placeholder="Minutes" value={f.min} onChange={(e) => set({ min: e.target.value })} />}
        </Field>
        <div className="flex items-end">
          <Check label="Already completed" checked={f.done} onChange={(v) => set({ done: v })} />
        </div>
      </div>
      {clash && (
        <p className="mt-4 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
          This overlaps college ({data.settings.collegeStart}–{data.settings.collegeEnd}, home by {data.settings.homeBy}) on a college day. You can still save it.
        </p>
      )}
      {err && (
        <p role="alert" className="mt-4 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
          {err}
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save}>
          Save
        </Button>
      </div>
    </Modal>
  )
}

const KIND_ACT: Partial<Record<PlanKind, Activity>> = { lecture: 'lecture', practice: 'practice', revision: 'revision', self: 'self' }

export default function Planner() {
  const { data, put, del, setSettings } = useStore()
  const { subjects, subject } = useSubjects()
  const [ws, setWs] = useState(weekStart(today()))
  const [form, setForm] = useState<Partial<PlanItem> | null>(null)
  const [log, setLog] = useState<Partial<Session> | null>(null)
  const [targets, setTargets] = useState(false)
  const t = today()
  const days = rangeDays(ws, addDays(ws, 6))
  const weekPlans = data.plans.filter((p) => p.date >= ws && p.date <= addDays(ws, 6))
  const info = (d: string): DayInfo => data.days.find((x) => x.id === d) ?? { id: d, college: data.settings.collegeDays.includes(dow(d)), office: false, semExam: false, dayType: 'normal' }
  const study = weekPlans.filter(isStudyPlan)
  const plannedMin = study.reduce((a, p) => a + p.plannedMin, 0)
  const doneMin = study.filter((p) => p.done).reduce((a, p) => a + p.plannedMin, 0)
  const alloc = subjects.map((s) => ({ s, planned: study.filter((p) => p.subjectId === s.id).reduce((a, p) => a + p.plannedMin, 0), target: (data.settings.weeklyTargets[s.id] ?? 0) * 60 })).filter((x) => x.planned > 0 || x.target > 0)

  return (
    <>
      <PageHeader title="Study Planner" sub="Plan around college and office. Nothing here is forced; adjust any day.">
        <Button onClick={() => setTargets(true)}>Daily targets</Button>
        <Button variant="primary" onClick={() => setForm({ date: t >= ws && t <= addDays(ws, 6) ? t : ws })}>
          + Plan activity
        </Button>
      </PageHeader>
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <Button aria-label="Previous week" onClick={() => setWs(addDays(ws, -7))}>
            ←
          </Button>
          <span className="text-sm font-medium">
            {fmtShort(ws)} – {fmtDate(addDays(ws, 6))}
          </span>
          <Button aria-label="Next week" onClick={() => setWs(addDays(ws, 7))}>
            →
          </Button>
          <Button variant="ghost" onClick={() => setWs(weekStart(t))}>
            This week
          </Button>
          <span className="ml-auto text-sm text-ink-2">
            Planned <span className="tnum font-medium text-ink">{fmtHM(plannedMin)}</span> · done <span className="tnum font-medium text-ink">{fmtHM(doneMin)}</span>
          </span>
        </div>
        {alloc.length > 0 && (
          <div className="mt-4 grid gap-x-6 gap-y-3 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-4">
            {alloc.map(({ s, planned, target }) => (
              <div key={s.id} className="text-[13px]">
                <div className="mb-1 flex justify-between">
                  <span className="inline-flex items-center gap-1.5 text-ink-2">
                    <Dot slot={s.slot} />
                    {s.short}
                  </span>
                  <span className="tnum">
                    {fmtHM(planned)}
                    {target > 0 && <span className="text-ink-3"> / {fmtHM(target)} target</span>}
                  </span>
                </div>
                <Progress value={target > 0 ? (100 * planned) / target : 100} color={`var(--s${s.slot})`} className="h-1.5!" />
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {days.map((d) => {
          const i = info(d)
          const items = weekPlans.filter((p) => p.date === d).sort((a, b) => (a.start ?? '99').localeCompare(b.start ?? '99'))
          const st = items.filter(isStudyPlan)
          const min = st.reduce((a, p) => a + p.plannedMin, 0)
          const target = data.settings.dailyTargetHours[i.dayType] * 60
          return (
            <section key={d} className={cx('flex flex-col border-2 border-ink bg-surface', d === t ? 'shadow-[6px_6px_0_var(--hi)]' : 'hard')}>
              <header className="border-b border-line px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold">{fmtDay(d)}</span> <span className="text-sm text-ink-3">{fmtShort(d)}</span>
                  </div>
                  <span className="tnum text-[13px] text-ink-2">
                    {fmtHM(min)} / {fmtHM(target)}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {i.college && <Badge>College {data.settings.collegeStart}–{data.settings.collegeEnd}</Badge>}
                  {i.office && <Badge tone="warn">Office</Badge>}
                  {i.semExam && <Badge tone="bad">Semester exam</Badge>}
                  {i.dayType !== 'normal' && <Badge tone="accent">{i.dayType}</Badge>}
                  {min > target && target > 0 && <Badge tone="warn">Over target</Badge>}
                </div>
              </header>
              <ul className="flex-1 divide-y divide-line">
                {items.map((p) => (
                  <li key={p.id} className="flex items-start gap-2.5 px-4 py-2.5">
                    <input type="checkbox" aria-label={`Mark ${p.title} done`} className="mt-1 size-4 accent-(--accent)" checked={p.done} onChange={(e) => put('plans', { ...p, done: e.target.checked })} />
                    <div className="min-w-0 flex-1">
                      <div className={cx('text-sm', p.done && 'text-ink-3 line-through')}>{p.title}</div>
                      <div className="tnum text-xs text-ink-3">
                        {p.start ? `${p.start}–${p.end} · ` : ''}
                        {fmtHM(p.plannedMin)} · {kindLabel(p.kind)}
                        {p.fromBacklog ? ' · backlog' : ''}
                        {!p.done && d < t && isStudyPlan(p) ? ' · missed' : ''}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {KIND_ACT[p.kind] && (
                          <Button size="sm" variant="ghost" onClick={() => (put('plans', { ...p, done: true }), setLog({ date: p.date, subjectId: p.subjectId, chapterId: p.chapterId, activity: KIND_ACT[p.kind], start: p.start, end: p.end, durationMin: p.plannedMin }))}>
                            Done & log
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setForm(p)}>
                          Edit
                        </Button>
                        <ConfirmButton onConfirm={() => del('plans', p.id)} />
                      </div>
                    </div>
                    {p.subjectId && <Dot slot={subject(p.subjectId)?.slot ?? 1} />}
                  </li>
                ))}
                {items.length === 0 && <li className="px-4 py-5 text-sm text-ink-3">Nothing planned.</li>}
              </ul>
              <div className="border-t border-line p-2">
                <Button size="sm" variant="ghost" className="w-full" onClick={() => setForm({ date: d })}>
                  + Add to {fmtDay(d)}
                </Button>
              </div>
            </section>
          )
        })}
      </div>

      {form && <PlanForm initial={form} onClose={() => setForm(null)} />}
      {log && <SessionForm initial={log} onClose={() => setLog(null)} />}
      {targets && (
        <Modal title="Daily study targets" onClose={() => setTargets(false)}>
          <p className="mb-4 text-sm text-ink-3">Hours you aim to study on each type of day. Set the day type in the Daily Study Log.</p>
          <div className="grid grid-cols-2 gap-4">
            {(['normal', 'busy', 'exam', 'holiday'] as const).map((k) => (
              <Field key={k} label={`${k[0].toUpperCase()}${k.slice(1)} day (hours)`}>
                <input type="number" min="0" max="16" step="0.5" className="inp" value={data.settings.dailyTargetHours[k]} onChange={(e) => setSettings({ dailyTargetHours: { ...data.settings.dailyTargetHours, [k]: Math.max(0, Math.min(16, num(e.target.value))) } })} />
              </Field>
            ))}
          </div>
          <div className="mt-5 flex justify-end">
            <Button variant="primary" onClick={() => setTargets(false)}>
              Done
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}
