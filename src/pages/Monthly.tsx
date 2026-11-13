import { useMemo, useState } from 'react'
import { Bars, CAT_SERIES, HBars, Lines } from '../components/charts'
import { Button, Card, Empty, PageHeader, pct, Stat } from '../components/ui'
import { periodReview, seriesDaily, snapshotAt } from '../lib/analytics'
import { addDays, fmtDate, fmtHM, fmtMonth, fmtShort, monthKey, parseISO, toISO, today, weekStart } from '../lib/dates'
import { useStore } from '../lib/store'

const shift = (key: string, n: number) => {
  const [y, m] = key.split('-').map(Number)
  return monthKey(toISO(new Date(y, m - 1 + n, 1)))
}

export default function Monthly() {
  const { data, sum } = useStore()
  const t = today()
  const [mk, setMk] = useState(monthKey(t))
  const from = `${mk}-01`
  const lastDay = toISO(new Date(parseISO(from).getFullYear(), parseISO(from).getMonth() + 1, 0))
  const to = lastDay
  const r = useMemo(() => periodReview(data, from, to), [data, from, to])
  const prev = useMemo(() => periodReview(data, `${shift(mk, -1)}-01`, addDays(from, -1)), [data, mk, from])
  const daily = seriesDaily(data.sessions, from, to)
  const dailyH = daily.map((d) => ({ date: d.date, lecture: d.lecture / 60, self: d.self / 60, practice: d.practice / 60, revision: d.revision / 60 }))
  // Weeks inside the month, for the consistency trend.
  const weeks = new Map<string, { week: string; hours: number; days: number }>()
  for (const d of daily) {
    const w = weekStart(d.date)
    const x = weeks.get(w) ?? { week: w, hours: 0, days: 0 }
    x.hours += d.total / 60
    if (d.total > 0) x.days++
    weeks.set(w, x)
  }
  const end = snapshotAt(data, to)
  const start = snapshotAt(data, addDays(from, -1))
  const change = (k: 'overall' | 'g1' | 'g2' | 'revision') => (end ? end[k] - (start?.[k] ?? 0) : null)
  const fmtChange = (v: number | null) => (v == null ? '—' : `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)} pts`)
  const scored = r.tests.filter((x) => x.totalMarks > 0).sort((a, b) => a.date.localeCompare(b.date))
  const current = mk === monthKey(t)
  const delta = r.totals.total - prev.totals.total
  const noData = r.totals.total === 0
  const none = <Empty title={`No study logged in ${fmtMonth(mk)}`} />

  return (
    <>
      <PageHeader title="Monthly Analytics" sub="Hours, progress, revision, tests and consistency for a calendar month." />
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <Button aria-label="Previous month" onClick={() => setMk(shift(mk, -1))}>
            ←
          </Button>
          <span className="min-w-24 text-center text-sm font-medium">{fmtMonth(mk)}</span>
          <Button aria-label="Next month" disabled={current} onClick={() => setMk(shift(mk, 1))}>
            →
          </Button>
          {!current && (
            <Button variant="ghost" onClick={() => setMk(monthKey(t))}>
              This month
            </Button>
          )}
        </div>
      </Card>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total hours" value={fmtHM(r.totals.total)} hint={prev.totals.total || r.totals.total ? `${delta >= 0 ? '+' : '−'}${fmtHM(Math.abs(delta))} vs ${fmtMonth(shift(mk, -1))}` : undefined} />
        <Stat label="Active days" value={`${r.activeDays} / ${r.days}`} hint={r.activeDays ? `${fmtHM(r.totals.total / r.activeDays)} per active day` : undefined} />
        <Stat label="Syllabus change" value={fmtChange(change('overall'))} hint={end ? `Ended at ${end.overall.toFixed(1)}%` : 'No progress snapshot in this month'} tone={(change('overall') ?? 0) > 0 ? 'good' : undefined} />
        <Stat label="Revision change" value={fmtChange(change('revision'))} hint={end ? `Ended at ${end.revision.toFixed(1)}%` : undefined} />
        <Stat label="Lectures completed" value={r.lectures} />
        <Stat label="Chapters completed" value={r.chaptersCompleted.length} />
        <Stat label="Tests taken" value={r.tests.length} hint={r.avgScore != null ? `Average ${pct(r.avgScore)}` : undefined} />
        <Stat label="Question accuracy" value={r.qAttempted ? `${r.qCorrect}/${r.qAttempted}` : '—'} hint="recorded correct / attempted" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Daily hours" className="lg:col-span-2">
          <Bars data={dailyH} xKey="date" series={CAT_SERIES} stacked fmtX={(d) => String(Number(d.slice(8)))} fmtLabel={fmtDate} empty={none} />
        </Card>
        <Card title="Subject-wise hours">
          <HBars fmt={fmtHM} rows={r.bySubject.map((s) => ({ key: s.subject.id, label: s.subject.short, value: s.minutes, color: `var(--s${s.subject.slot})`, note: `${s.lectures} lectures` }))} empty={none} />
        </Card>
        <Card title="Subject-wise syllabus change" sub="Percentage points gained during the month">
          <HBars
            fmt={(v) => `+${v.toFixed(1)}`}
            rows={sum.ss.map((s) => ({ key: s.subject.id, label: s.subject.short, value: Math.max(0, (end?.subjects[s.subject.id] ?? 0) - (start?.subjects[s.subject.id] ?? 0)), color: `var(--s${s.subject.slot})` }))}
            empty={<Empty title="No syllabus movement recorded">{end ? 'Completion did not rise this month.' : 'Progress snapshots are saved on days you use the app.'}</Empty>}
          />
        </Card>
        <Card title="Consistency by week" sub="Active days in each week of the month">
          <Bars data={[...weeks.values()].map((w) => ({ week: w.week, days: w.days }))} xKey="week" series={[{ key: 'days', label: 'Active days', color: 'var(--s3)' }]} yMax={7} fmtX={fmtShort} fmtLabel={(w) => `Week of ${fmtDate(w)}`} fmtValue={(v) => `${v} day${v === 1 ? '' : 's'}`} empty={none} />
        </Card>
        <Card title="Test performance" sub="Scores in date order">
          <Lines data={scored.map((x, i) => ({ i: String(i + 1), score: Math.round((1000 * x.marks) / x.totalMarks) / 10 }))} xKey="i" series={[{ key: 'score', label: 'Score %', color: 'var(--s1)' }]} yMax={100} fmtX={(i) => `#${i}`} fmtLabel={(i) => `Test #${i} · ${fmtDate(scored[Number(i) - 1]?.date ?? t)}`} fmtValue={(v) => `${v}%`} empty={<Empty title="No scored tests this month" />} />
        </Card>
      </div>
      {noData && !current && <p className="mt-3 text-xs text-ink-3">Nothing was logged in this month.</p>}
    </>
  )
}
