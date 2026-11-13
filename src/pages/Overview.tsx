import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bars, CAT_SERIES, HBars, Heatmap } from '../components/charts'
import { Badge, Card, Empty, PageHeader, pct, Progress, Ring, Seg, Stat } from '../components/ui'
import { dailyMap, seriesDaily, seriesMonthly, seriesWeekly } from '../lib/analytics'
import { addDays, fmtDate, fmtHM, fmtMonth, fmtShort, hrs, today } from '../lib/dates'
import { useStore } from '../lib/store'

const toHours = (rows: object[]) =>
  rows.map((r) => {
    const o: Record<string, string | number> = {}
    for (const [k, v] of Object.entries(r)) o[k] = typeof v === 'number' ? Math.round((v / 60) * 100) / 100 : (v as string)
    return o
  })

export default function Overview() {
  const { data, sum, user } = useStore()
  const t = today()
  const [range, setRange] = useState<'14' | '30' | '90'>('14')
  const noSessions = data.sessions.length === 0
  const logFirst = (
    <Empty title="Nothing logged yet">
      Charts fill in as soon as you log your first study session. Use “+ Log session” or the timer at the top.
    </Empty>
  )

  const daily = useMemo(() => toHours(seriesDaily(data.sessions, addDays(t, -(Number(range) - 1)), t)), [data.sessions, range, t])
  const weekly = useMemo(() => toHours(seriesWeekly(data.sessions, 12, t)), [data.sessions, t])
  const monthly = useMemo(() => toHours(seriesMonthly(data.sessions, data.settings.startDate, t)), [data.sessions, data.settings.startDate, t])
  const heat = useMemo(() => new Map([...dailyMap(data.sessions)].map(([d, v]) => [d, v.total])), [data.sessions])
  // At least 16 weeks, at most 26, reaching back to the preparation start when that is earlier.
  const heatFrom = [addDays(t, -181), [data.settings.startDate, addDays(t, -111)].sort()[0]].sort()[1]
  const todayMin = heat.get(t) ?? 0
  const dayInfo = data.days.find((d) => d.id === t)
  const target = data.settings.dailyTargetHours[dayInfo?.dayType ?? 'normal']
  const plansToday = data.plans.filter((p) => p.date === t)
  const revCounts = [0, 1, 2, 3].map((n) => sum.cs.filter((c) => c.revisionsDone === n).length)
  const behind = sum.ss.filter((s) => s.behind > 0)
  const started = t >= data.settings.startDate

  return (
    <>
      <PageHeader title={`Overview`} sub={`${user?.name ? `${user.name} · ` : ''}${fmtDate(t)}${started ? '' : ` · preparation starts ${fmtDate(data.settings.startDate)}`}`} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <Ring value={sum.comp.overall} sub="syllabus" />
            <div className="w-full flex-1 space-y-4">
              {[
                { label: 'Group 1', v: sum.comp.g1 },
                { label: 'Group 2', v: sum.comp.g2 },
                { label: 'Revision (3 cycles)', v: sum.comp.revision },
              ].map((r) => (
                <div key={r.label}>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="text-ink-2">{r.label}</span>
                    <span className="tnum font-medium">{r.v.toFixed(1)}%</span>
                  </div>
                  <Progress value={r.v} />
                </div>
              ))}
              <p className="text-xs text-ink-3">A chapter counts 50% lectures, 25% practice, 25% revision. Finishing lectures alone never completes it.</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex h-full flex-col justify-between gap-4">
            <div>
              <div className="text-[12.5px] text-ink-3">Days to the exam</div>
              <div className="tnum text-4xl font-semibold tracking-tight">{Math.max(0, sum.daysLeft)}</div>
              <div className="text-[13px] text-ink-3">Target {fmtDate(data.settings.examDate)}</div>
            </div>
            <div>
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="text-ink-2">Today</span>
                <span className="tnum font-medium">
                  {fmtHM(todayMin)} / {target}h
                </span>
              </div>
              <Progress value={target > 0 ? (100 * todayMin) / (target * 60) : 0} color="var(--s3)" />
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone={sum.streak.current > 0 ? 'good' : 'neutral'}>{sum.streak.current}-day streak</Badge>
                <Badge>Best {sum.streak.best}</Badge>
                {plansToday.length > 0 && (
                  <Badge tone="accent">
                    {plansToday.filter((p) => p.done).length}/{plansToday.length} planned done
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Stat label="Total study" value={fmtHM(sum.totals.total)} />
        <Stat label="Lectures" value={fmtHM(sum.totals.lecture)} />
        <Stat label="Self-study" value={fmtHM(sum.totals.self)} />
        <Stat label="Question practice" value={fmtHM(sum.totals.practice)} />
        <Stat label="Revision" value={fmtHM(sum.totals.revision)} />
        <Stat label="Active study days" value={sum.active} hint={sum.active ? `${fmtHM(sum.avgPerActive)} avg per active day` : 'Days with zero hours do not count'} />
        <Stat label="Chapters completed" value={sum.completed} hint={`of ${sum.cs.length}`} tone={sum.completed ? 'good' : undefined} />
        <Stat label="In progress" value={sum.inProgress} />
        <Stat label="Not started" value={sum.pending} />
        <Stat label="Lectures pending" value={sum.lecturesLeft} hint={sum.lecturesLeft ? `≈ ${fmtHM(sum.lecturesRemainingMin)} to watch` : 'Enter lecture counts to track'} />
        <Stat label="Behind pace" value={sum.lecturesBehind} hint="lectures vs target dates" tone={sum.lecturesBehind ? 'warn' : undefined} />
        <Stat label="Backlog" value={sum.backlog.length} hint={sum.backlog.length ? `≈ ${fmtHM(sum.backlogMin)} to clear` : 'Nothing pending'} tone={sum.backlog.length ? 'warn' : undefined} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="What needs attention" className="lg:col-span-1" action={<Link to="/backlog" className="text-sm text-accent">Backlog →</Link>}>
          {sum.backlog.length === 0 && behind.length === 0 ? (
            <p className="text-sm text-ink-3">No backlog. {noSessions ? 'Set lecture counts in the Syllabus Tracker and target dates in Subjects so the tracker can tell you when you slip.' : 'Keep going.'}</p>
          ) : (
            <ul className="space-y-2.5 text-sm">
              {sum.backlog.slice(0, 6).map((b) => (
                <li key={b.key} className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate">{b.title}</span>
                    <span className="block truncate text-xs text-ink-3">{b.detail}</span>
                  </span>
                  <span className="tnum shrink-0 text-ink-3">{fmtHM(b.minutes)}</span>
                </li>
              ))}
              {sum.backlog.length > 6 && <li className="text-xs text-ink-3">and {sum.backlog.length - 6} more</li>}
            </ul>
          )}
        </Card>
        <Card title="Daily study hours" sub="Stacked by activity" className="lg:col-span-2" action={<Seg value={range} onChange={setRange} options={[{ id: '14', label: '14 days' }, { id: '30', label: '30 days' }, { id: '90', label: '90 days' }]} />}>
          <Bars data={daily} xKey="date" series={CAT_SERIES} stacked fmtX={fmtShort} fmtLabel={fmtDate} refY={target} refLabel={`Target ${target}h`} empty={logFirst} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Weekly study hours" sub="Last 12 weeks, week starting Monday">
          <Bars data={weekly} xKey="week" series={CAT_SERIES} stacked fmtX={fmtShort} fmtLabel={(w) => `Week of ${fmtDate(w)}`} empty={logFirst} />
        </Card>
        <Card title="Monthly trend" sub="Total hours per month">
          <Bars data={monthly} xKey="month" series={[{ key: 'total', label: 'Total hours', color: 'var(--s1)' }]} fmtX={(m) => fmtMonth(m).slice(0, 3)} fmtLabel={fmtMonth} empty={logFirst} />
        </Card>
        <Card title="Subject-wise syllabus completion">
          <HBars max={100} fmt={pct} rows={sum.ss.map((s) => ({ key: s.subject.id, label: s.subject.short, value: s.completion, color: `var(--s${s.subject.slot})`, note: `${s.completed}/${s.chapters.length} chapters complete` }))} empty={<Empty title="No progress recorded yet">Mark lectures, practice and revisions in the Syllabus Tracker.</Empty>} />
        </Card>
        <Card title="Subject-wise study hours">
          <HBars fmt={(v) => fmtHM(v)} rows={sum.ss.map((s) => ({ key: s.subject.id, label: s.subject.short, value: s.minutes, color: `var(--s${s.subject.slot})` }))} empty={logFirst} />
        </Card>
        <Card title="Group 1 vs Group 2" sub="Average of each group's three papers">
          <HBars
            max={100}
            fmt={pct}
            rows={sum.comp.papers.map((p) => ({ key: String(p.paper), label: `G${p.group} · P${p.paper}`, value: p.completion, color: p.group === 1 ? 'var(--s1)' : 'var(--s2)', note: p.name }))}
            empty={<Empty title="No progress recorded yet" />}
          />
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
            <div>
              <span className="text-ink-3">Group 1</span> <span className="tnum font-semibold">{sum.comp.g1.toFixed(1)}%</span>
            </div>
            <div>
              <span className="text-ink-3">Group 2</span> <span className="tnum font-semibold">{sum.comp.g2.toFixed(1)}%</span>
            </div>
          </div>
        </Card>
        <Card title="Lecture hours vs practice hours" sub="Per week">
          <Bars data={weekly} xKey="week" series={[CAT_SERIES[0], CAT_SERIES[2]]} fmtX={fmtShort} fmtLabel={(w) => `Week of ${fmtDate(w)}`} empty={logFirst} />
          {!noSessions && (
            <p className="mt-3 text-[13px] text-ink-3">
              Overall: {hrs(sum.totals.lecture)}h lectures to {hrs(sum.totals.practice)}h practice.
            </p>
          )}
        </Card>
        <Card title="Revision progress" sub="Chapters by number of revisions done">
          <HBars
            max={sum.cs.length}
            fmt={(v) => `${v}`}
            rows={['Never revised', 'Revised once', 'Revised twice', 'Revised 3 times'].map((label, i) => ({ key: label, label, value: revCounts[i], color: i === 0 ? 'var(--ink-3)' : 'var(--s4)' }))}
          />
        </Card>
        <Card title="Study consistency" sub="Each square is a day; darker means more hours">
          <Heatmap minutes={heat} from={heatFrom} to={t} />
        </Card>
      </div>
    </>
  )
}
