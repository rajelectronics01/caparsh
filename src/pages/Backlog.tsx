import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, Check, Empty, Field, num, PageHeader, Seg, Stat, useToast } from '../components/ui'
import { distribute, periodReview, type BacklogItem } from '../lib/analytics'
import { addDays, diffDays, fmtDate, fmtDay, fmtHM, fmtShort, today, weekStart } from '../lib/dates'
import { useStore } from '../lib/store'

const TYPE_LABEL: Record<BacklogItem['type'], string> = { lecture: 'Lectures', practice: 'Practice', revision: 'Revision', plan: 'Missed plan' }

export default function Backlog() {
  const { sum, data, putMany, delMany } = useStore()
  const toast = useToast()
  const t = today()
  const [type, setType] = useState<'all' | BacklogItem['type']>('all')
  const [picked, setPicked] = useState<Set<string> | null>(null)
  const [days, setDays] = useState('7')
  const [cap, setCap] = useState('90')
  const [skipExam, setSkipExam] = useState(true)

  const scheduled = useMemo(() => new Set(data.plans.filter((p) => p.fromBacklog && !p.done && p.date >= t).map((p) => p.title)), [data.plans, t])
  const items = sum.backlog.filter((b) => type === 'all' || b.type === type)
  const sel = picked ?? new Set(sum.backlog.filter((b) => !scheduled.has(b.title)).map((b) => b.key))
  const chosen = sum.backlog.filter((b) => sel.has(b.key))
  const blocked = new Set(skipExam ? data.days.filter((d) => d.semExam || d.dayType === 'exam').map((d) => d.id) : [])
  const nDays = Math.max(1, Math.min(60, Math.round(num(days, 7))))
  const capMin = Math.max(15, Math.round(num(cap, 90)))
  const preview = useMemo(() => distribute(chosen, addDays(t, 1), nDays, capMin, blocked), [chosen, t, nDays, capMin, blocked])
  const byDay = new Map<string, number>()
  for (const p of preview.plans) byDay.set(p.date, (byDay.get(p.date) ?? 0) + p.plannedMin)

  const toggle = (k: string) => {
    const n = new Set(sel)
    if (n.has(k)) n.delete(k)
    else n.add(k)
    setPicked(n)
  }
  const apply = () => {
    if (!preview.plans.length) return
    putMany(
      preview.plans.map((p) => {
        const id = crypto.randomUUID()
        return { collection: 'plans' as const, id, data: { ...p, id } }
      }),
    )
    // A missed plan that has been rescheduled is replaced by its new slot rather than left as a duplicate.
    const moved = chosen.filter((c) => c.planId && preview.plans.some((p) => p.title === c.title)).map((c) => ({ collection: 'plans' as const, id: c.planId! }))
    delMany(moved)
    setPicked(new Set())
    toast(`Added ${preview.plans.length} activities to the planner`)
  }

  const week = periodReview(data, weekStart(t), t)
  const elapsed = (diffDays(weekStart(t), t) + 1) / 7
  const slipping = week.bySubject.filter((s) => s.targetMin > 0 && s.minutes < s.targetMin * elapsed * 0.8)
  const behind = sum.ss.filter((s) => s.behind > 0)
  const count = (ty: BacklogItem['type']) => sum.backlog.filter((b) => b.type === ty)

  return (
    <>
      <PageHeader title="Backlog Manager" sub="What slipped, how long it takes to clear, and a way to spread it without wrecking tomorrow." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Lectures pending" value={sum.lecturesLeft} hint={`≈ ${fmtHM(sum.lecturesRemainingMin)} in total`} />
        <Stat label="Lectures behind pace" value={sum.lecturesBehind} tone={sum.lecturesBehind ? 'warn' : undefined} hint={`≈ ${fmtHM(count('lecture').reduce((a, b) => a + b.minutes, 0))}`} />
        <Stat label="Practice backlog" value={count('practice').length} hint="chapters" />
        <Stat label="Revision backlog" value={count('revision').length} hint="chapters" />
        <Stat label="Missed plans" value={count('plan').length} />
        <Stat label="Time to clear" value={fmtHM(sum.backlogMin)} tone={sum.backlogMin ? 'warn' : 'good'} hint="estimated" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Subjects falling behind">
          {behind.length === 0 && slipping.length === 0 ? (
            <p className="text-sm text-ink-3">
              None flagged. This needs a “finish lectures by” date or a weekly target on each subject. <Link className="text-accent" to="/subjects">Set them in Subjects</Link>.
            </p>
          ) : (
            <ul className="space-y-2.5 text-sm">
              {behind.map((s) => (
                <li key={s.subject.id} className="flex justify-between gap-3">
                  <span>{s.subject.name}</span>
                  <Badge tone="warn">
                    {s.behind} lectures behind ({s.lecturesDone}/{s.expected} expected)
                  </Badge>
                </li>
              ))}
              {slipping.map((s) => (
                <li key={`w-${s.subject.id}`} className="flex justify-between gap-3">
                  <span>{s.subject.name}</span>
                  <Badge tone="warn">
                    {fmtHM(s.minutes)} of {fmtHM(s.targetMin)} weekly target
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Spread the backlog" sub="Each day takes only the extra time you allow. Whatever does not fit stays in the backlog.">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Over the next (days)">
              <input type="number" min="1" max="60" className="inp" value={days} onChange={(e) => setDays(e.target.value)} />
            </Field>
            <Field label="Max extra per day (min)">
              <input type="number" min="15" step="15" className="inp" value={cap} onChange={(e) => setCap(e.target.value)} />
            </Field>
          </div>
          <div className="mt-2">
            <Check label="Skip semester-exam days" checked={skipExam} onChange={setSkipExam} />
          </div>
          {chosen.length === 0 ? (
            <p className="mt-3 text-sm text-ink-3">Select backlog items below to preview a schedule.</p>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[...byDay.entries()].sort().map(([d, m]) => (
                  <span key={d} className="tnum rounded-md bg-surface-2 px-2 py-1 text-xs">
                    {fmtDay(d)} {fmtShort(d)} · {fmtHM(m)}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-[13px] text-ink-2">
                {chosen.length} item{chosen.length > 1 ? 's' : ''} selected · {fmtHM(chosen.reduce((a, b) => a + b.minutes, 0))} total
                {preview.leftoverMin > 0 && <span className="text-warn"> · {fmtHM(preview.leftoverMin)} does not fit and stays in the backlog</span>}
              </p>
              <Button variant="primary" className="mt-3" disabled={!preview.plans.length} onClick={apply}>
                Add to planner
              </Button>
            </>
          )}
        </Card>
      </div>

      <Card className="mt-4" title="Backlog items" pad={false} action={<Seg value={type} onChange={setType} options={[{ id: 'all', label: 'All' }, { id: 'lecture', label: 'Lectures' }, { id: 'practice', label: 'Practice' }, { id: 'revision', label: 'Revision' }, { id: 'plan', label: 'Missed' }]} />}>
        <div className="p-5">
          {items.length === 0 ? (
            <Empty title={sum.backlog.length ? 'Nothing of this type' : 'No backlog'}>
              {sum.backlog.length ? '' : 'Backlog appears when you fall behind a subject target date, finish lectures without practice or revision, pass a revision date, or miss a planned activity.'}
            </Empty>
          ) : (
            <ul className="divide-y divide-line">
              {items.map((b) => (
                <li key={b.key} className="flex items-start gap-3 py-3">
                  <input type="checkbox" aria-label={`Select ${b.title}`} className="mt-1 size-4 accent-(--accent)" checked={sel.has(b.key)} onChange={() => toggle(b.key)} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{b.title}</div>
                    <div className="text-[13px] text-ink-3">{b.detail}</div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge>{TYPE_LABEL[b.type]}</Badge>
                    <span className="tnum text-[13px] text-ink-2">≈ {fmtHM(b.minutes)}</span>
                    {scheduled.has(b.title) && <Badge tone="accent">Scheduled</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
      <p className="mt-3 text-xs text-ink-3">Estimates use each subject's average lecture length, 4 minutes per practice question and 1 hour per revision. As of {fmtDate(t)}.</p>
    </>
  )
}
