import { useMemo, useState } from 'react'
import { Bars, CAT_SERIES } from '../components/charts'
import { Badge, Button, Card, Dot, Empty, Field, Modal, num, PageHeader, pct, Progress, Stat } from '../components/ui'
import { periodReview, seriesDaily } from '../lib/analytics'
import { addDays, fmtDate, fmtDay, fmtHM, fmtShort, today, weekStart } from '../lib/dates'
import { useStore } from '../lib/store'

export default function Weekly() {
  const { data, sum, setSettings } = useStore()
  const t = today()
  const [ws, setWs] = useState(weekStart(t))
  const [edit, setEdit] = useState(false)
  const we = addDays(ws, 6)
  const r = useMemo(() => periodReview(data, ws, we), [data, ws, we])
  const prev = useMemo(() => periodReview(data, addDays(ws, -7), addDays(ws, -1)), [data, ws])
  const daily = seriesDaily(data.sessions, ws, we).map((d) => ({ date: d.date, lecture: d.lecture / 60, self: d.self / 60 }))
  const targetTotal = r.bySubject.reduce((a, s) => a + s.targetMin, 0)
  const current = ws === weekStart(t)
  const delta = r.totals.total - prev.totals.total
  const behind = r.bySubject.filter((s) => s.targetMin > 0 && s.minutes < s.targetMin)

  return (
    <>
      <PageHeader title="Weekly Review" sub="Calculated automatically from your log. Weeks run Monday to Sunday.">
        <Button onClick={() => setEdit(true)}>Weekly targets</Button>
      </PageHeader>
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <Button aria-label="Previous week" onClick={() => setWs(addDays(ws, -7))}>
            ←
          </Button>
          <span className="text-sm font-medium">
            {fmtShort(ws)} – {fmtDate(we)}
          </span>
          <Button aria-label="Next week" disabled={current} onClick={() => setWs(addDays(ws, 7))}>
            →
          </Button>
          {!current && (
            <Button variant="ghost" onClick={() => setWs(weekStart(t))}>
              This week
            </Button>
          )}
          {current && <Badge tone="accent">In progress</Badge>}
        </div>
      </Card>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total study" value={fmtHM(r.totals.total)} hint={prev.totals.total || r.totals.total ? `${delta >= 0 ? '+' : '−'}${fmtHM(Math.abs(delta))} vs previous week` : undefined} />
        <Stat label="Against target" value={targetTotal ? pct((100 * r.totals.total) / targetTotal) : '—'} hint={targetTotal ? `of ${fmtHM(targetTotal)} targeted` : 'No weekly targets set'} tone={targetTotal && r.totals.total >= targetTotal ? 'good' : undefined} />
        <Stat label="Active days" value={`${r.activeDays} / 7`} />
        <Stat label="Lectures completed" value={r.lectures} />
        <Stat label="Lecture hours" value={fmtHM(r.totals.lecture)} />
        <Stat label="Chapters completed" value={r.chaptersCompleted.length} tone={r.chaptersCompleted.length ? 'good' : undefined} />
        <Stat label="Backlog generated" value={r.missedCount} hint={r.missedCount ? `${fmtHM(r.missedMin)} of planned work not done` : 'No planned work missed'} tone={r.missedCount ? 'warn' : undefined} />
        <Stat label="Self-study hours" value={fmtHM(r.totals.self)} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Hours by day">
          <Bars data={daily} xKey="date" series={CAT_SERIES} stacked fmtX={fmtDay} fmtLabel={fmtDate} empty={<Empty title="No study logged this week" />} />
        </Card>
        <Card title="Subject-wise: actual vs weekly target">
          {r.bySubject.every((s) => s.minutes === 0 && s.targetMin === 0) ? (
            <Empty title="Nothing to compare yet" action={<Button onClick={() => setEdit(true)}>Set weekly targets</Button>}>
              Set a weekly hours target per subject, then log sessions.
            </Empty>
          ) : (
            <ul className="space-y-3.5">
              {r.bySubject.map((s) => (
                <li key={s.subject.id} className="text-sm">
                  <div className="mb-1 flex flex-wrap justify-between gap-x-3">
                    <span className="inline-flex items-center gap-2">
                      <Dot slot={s.subject.slot} />
                      {s.subject.short}
                      {s.lectures > 0 && <span className="text-xs text-ink-3">{s.lectures} lectures</span>}
                    </span>
                    <span className="tnum">
                      {fmtHM(s.minutes)}
                      <span className="text-ink-3"> / {s.targetMin ? fmtHM(s.targetMin) : 'no target'}</span>
                    </span>
                  </div>
                  <Progress value={s.targetMin ? (100 * s.minutes) / s.targetMin : s.minutes > 0 ? 100 : 0} color={`var(--s${s.subject.slot})`} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Falling behind this week">
          {behind.length === 0 && sum.ss.every((s) => s.behind === 0) ? (
            <p className="text-sm text-ink-3">{targetTotal ? 'Every subject with a target has met it.' : 'Set weekly targets to have subjects flagged here.'}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {behind.map((s) => (
                <li key={s.subject.id} className="flex justify-between gap-3">
                  <span>{s.subject.name}</span>
                  <Badge tone="warn">{fmtHM(s.targetMin - s.minutes)} short of target</Badge>
                </li>
              ))}
              {current &&
                sum.ss
                  .filter((s) => s.behind > 0)
                  .map((s) => (
                    <li key={`p-${s.subject.id}`} className="flex justify-between gap-3">
                      <span>{s.subject.name}</span>
                      <Badge tone="warn">{s.behind} lectures behind pace</Badge>
                    </li>
                  ))}
            </ul>
          )}
        </Card>
        <Card title="Chapters completed this week">
          {r.chaptersCompleted.length === 0 ? (
            <p className="text-sm text-ink-3">None yet. A chapter counts once all its lectures are watched.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {r.chaptersCompleted.map((c) => (
                <li key={c.id} className="flex justify-between gap-3">
                  <span>{c.name}</span>
                  <span className="text-ink-3">{fmtShort(c.completedAt!)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      {edit && (
        <Modal title="Weekly targets per subject" onClose={() => setEdit(false)}>
          <div className="grid gap-4 sm:grid-cols-2">
            {sum.ss.map((s) => (
              <Field key={s.subject.id} label={`${s.subject.short} (hours / week)`}>
                <input type="number" min="0" step="0.5" className="inp" value={data.settings.weeklyTargets[s.subject.id] ?? ''} placeholder="0" onChange={(e) => setSettings({ weeklyTargets: { ...data.settings.weeklyTargets, [s.subject.id]: Math.max(0, num(e.target.value)) } })} />
              </Field>
            ))}
          </div>
          <p className="mt-4 text-sm text-ink-3">
            Total: <span className="tnum font-medium text-ink">{Object.values(data.settings.weeklyTargets).reduce((a, b) => a + (b || 0), 0)}h</span> per week
          </p>
          <div className="mt-4 flex justify-end">
            <Button variant="primary" onClick={() => setEdit(false)}>
              Done
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}
