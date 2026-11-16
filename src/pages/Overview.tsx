import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bars, CAT_SERIES, HBars, Heatmap } from '../components/charts'
import { Card, Empty, pct, Progress, Ring, Seg, Stat } from '../components/ui'
import { useShell } from '../components/Layout'
import { dailyMap, forecast, nextUp, seriesDaily, seriesMonthly, seriesWeekly, summarize } from '../lib/analytics'
import { addDays, fmtDate, fmtDay, fmtHM, fmtMonth, fmtShort, hrs, today } from '../lib/dates'
import { useStore } from '../lib/store'

const toHours = (rows: object[]) =>
  rows.map((r) => {
    const o: Record<string, string | number> = {}
    for (const [k, v] of Object.entries(r)) o[k] = typeof v === 'number' ? Math.round((v / 60) * 100) / 100 : (v as string)
    return o
  })

export default function Overview() {
  const { data, sum, user, friends, friendData, refreshFriends } = useStore()
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
  const { quickLog } = useShell()
  const todayPct = target > 0 ? Math.min(100, (100 * todayMin) / (target * 60)) : 0
  const next = useMemo(() => nextUp(data, sum, t), [data, sum, t])
  const fc = useMemo(() => forecast(data, sum, t), [data, sum, t])
  const alerts = 'Notification' in window && Notification.permission !== 'granted' && data.settings.reminders.some((r) => r.enabled) ? 'off' : 'ok'
  const revCounts = [0, 1, 2, 3].map((n) => sum.cs.filter((c) => c.revisionsDone === n).length)
  const behind = sum.ss.filter((s) => s.behind > 0)
  const started = t >= data.settings.startDate
  // Friends on the home screen: load once, then keep fresh while the page is visible.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') void refreshFriends().catch(() => {})
    }
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [refreshFriends])
  const board = useMemo(() => {
    const row = (id: string, name: string, s: typeof sum, sessions: typeof data.sessions, me: boolean) => ({ id, name, me, today: sessions.filter((x) => x.date === t).reduce((a, x) => a + x.durationMin, 0), week: s.last7.total, syllabus: s.comp.overall, streak: s.streak.current })
    const rows = [row('me', user?.name ?? 'You', sum, data.sessions, true)]
    for (const f of friends) {
      const fd = friendData[f.id]
      if (fd) rows.push(row(f.id, f.name, summarize(fd, t), fd.sessions, false))
    }
    return rows.sort((a, b) => b.week - a.week || b.today - a.today || Number(b.me) - Number(a.me))
  }, [sum, data.sessions, friends, friendData, user, t])
  const boardMax = Math.max(...board.map((r) => r.week), 0)

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="hard border-2 border-ink bg-hi p-5 text-hi-ink lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest">
                Today · {fmtDay(t)} {fmtDate(t)}
              </div>
              <h1 className="mt-1 text-4xl font-bold leading-none sm:text-5xl">Hi, {(user?.name ?? 'there').split(' ')[0]}</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="tnum border-2 border-ink bg-[var(--p4)] px-2 py-1 text-xs font-bold uppercase text-[var(--on-color)]">{sum.streak.current}-day streak</span>
              <span className="tnum border-2 border-ink bg-surface px-2 py-1 text-xs font-bold uppercase text-ink">Best {sum.streak.best}</span>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-end gap-x-3 gap-y-1">
            <span className="tnum text-6xl font-bold leading-none sm:text-7xl">{fmtHM(todayMin)}</span>
            <span className="tnum pb-1 text-xl font-bold">/ {target}h target</span>
          </div>
          <div className="mt-3 h-5 border-2 border-ink bg-surface" role="progressbar" aria-label="Today against target" aria-valuenow={Math.round(todayPct)} aria-valuemin={0} aria-valuemax={100}>
            <div className="fill h-full bg-[var(--pink)]" style={{ width: `${todayPct}%`, borderRight: todayPct > 0 && todayPct < 100 ? '2px solid #0a0a0a' : undefined }} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={() => quickLog()} className="press min-h-12 border-2 border-ink bg-ink px-5 text-sm font-bold uppercase tracking-wide text-bg">
              + Log study
            </button>
            <span className="text-sm font-medium">
              {!started ? `Preparation starts ${fmtDate(data.settings.startDate)}.` : todayMin === 0 ? 'Nothing logged yet today.' : todayMin >= target * 60 ? 'Target hit. Anything more is a bonus.' : `${fmtHM(target * 60 - todayMin)} to go.`}
            </span>
          </div>
        </section>
        <section className="hard flex flex-col justify-between border-2 border-ink bg-[var(--p2)] p-5 text-[var(--on-color)]">
          <div className="text-xs font-bold uppercase tracking-widest">Days to the exam</div>
          <div className="tnum text-7xl font-bold leading-none sm:text-8xl">{Math.max(0, sum.daysLeft)}</div>
          <div className="text-sm font-medium">Target {fmtDate(data.settings.examDate)} · both groups</div>
        </section>
      </div>

      <Card className="mt-4" title={friends.length ? 'You vs friends' : 'Study with a friend'} sub={friends.length ? 'Ranked by hours in the last 7 days · refreshes every 30 seconds' : undefined} action={<Link to="/compare" className="text-sm font-bold underline">{friends.length ? 'Full comparison →' : 'Add a friend →'}</Link>} pad={false}>
        {board.length < 2 ? (
          <p className="p-5 text-sm text-ink-3">{friends.length ? 'Loading your friend\u2019s numbers…' : 'Link a friend with their code and both of your numbers appear here, side by side.'}</p>
        ) : (
          <ul className="divide-y-2 divide-ink">
            {board.map((r, i) => (
              <li key={r.id} className={`grid grid-cols-[2rem_1fr] items-center gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[2rem_9rem_1fr_auto] ${r.me ? 'bg-[var(--p1)] text-[var(--on-color)]' : ''}`}>
                <span className="tnum text-2xl font-bold">{i + 1}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold uppercase">
                    {r.name}
                    {r.me ? ' (you)' : ''}
                  </span>
                  <span className="tnum block text-xs">{r.streak}-day streak</span>
                </span>
                <div className="col-span-2 sm:col-span-1">
                  <div className="h-4 border-2 border-ink bg-surface">
                    <div className="fill h-full" style={{ width: `${boardMax ? (100 * r.week) / boardMax : 0}%`, background: r.me ? 'var(--pink)' : 'var(--p3)' }} />
                  </div>
                </div>
                <dl className="tnum col-span-2 grid grid-cols-3 gap-x-4 text-right text-xs sm:col-span-1">
                  <div>
                    <dt className="font-sans text-[10px] font-bold uppercase tracking-wide opacity-70">Today</dt>
                    <dd className="text-sm font-bold">{fmtHM(r.today)}</dd>
                  </div>
                  <div>
                    <dt className="font-sans text-[10px] font-bold uppercase tracking-wide opacity-70">7 days</dt>
                    <dd className="text-sm font-bold">{fmtHM(r.week)}</dd>
                  </div>
                  <div>
                    <dt className="font-sans text-[10px] font-bold uppercase tracking-wide opacity-70">Syllabus</dt>
                    <dd className="text-sm font-bold">{r.syllabus.toFixed(1)}%</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {alerts === 'off' && (
        <div className="hard mt-4 flex flex-wrap items-center justify-between gap-3 border-2 border-ink bg-[var(--p5)] px-4 py-3 text-[var(--on-color)]">
          <span className="text-sm font-medium">Reminders are off on this device.</span>
          <Link to="/settings" className="press border-2 border-ink bg-hi px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-hi-ink">
            Turn on alerts
          </Link>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Next up" sub="Tap one to log it">
          <ul className="space-y-2">
            {next.map((n) => (
              <li key={n.key}>
                <button onClick={() => quickLog({ subjectId: n.subjectId, chapterId: n.chapterId, activity: n.activity, durationMin: n.minutes })} className="press flex w-full items-center gap-3 border-2 border-ink bg-surface px-3 py-2.5 text-left hover:bg-surface-2">
                  <span className="h-9 w-2 shrink-0" style={{ background: `var(--s${data.subjects.find((x) => x.id === n.subjectId)?.slot ?? 1})` }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{n.title}</span>
                    <span className="block truncate text-xs text-ink-3">{n.why}</span>
                  </span>
                  <span className="tnum shrink-0 text-xs font-bold">{fmtHM(n.minutes)}</span>
                </button>
              </li>
            ))}
            {next.length === 0 && <li className="text-sm text-ink-3">Everything is complete.</li>}
          </ul>
        </Card>
        <Card title="Syllabus">
          <div className="flex items-center gap-5">
            <Ring value={sum.comp.overall} size={112} sub="done" />
            <div className="w-full flex-1 space-y-3">
              {[
                { label: 'Group 1', v: sum.comp.g1 },
                { label: 'Group 2', v: sum.comp.g2 },
                { label: 'Revision', v: sum.comp.revision },
              ].map((r) => (
                <div key={r.label}>
                  <div className="mb-1 flex justify-between text-[13px]">
                    <span className="font-bold uppercase tracking-wide">{r.label}</span>
                    <span className="tnum font-bold">{r.v.toFixed(1)}%</span>
                  </div>
                  <Progress value={r.v} />
                </div>
              ))}
            </div>
          </div>
          <p className="mt-3 text-xs text-ink-3">Lectures 50%, practice 25%, revision 25%. Lectures alone never finish a chapter.</p>
        </Card>
        <Card title="Forecast" sub="Where your last 14 days lead">
          {!fc.hasCounts ? (
            <p className="text-sm text-ink-3">
              Enter lecture counts in the <Link className="font-bold text-accent underline" to="/lectures">Lecture Tracker</Link> and this will tell you when you finish at your current pace.
            </p>
          ) : fc.lecturesLeft === 0 ? (
            <p className="text-sm font-bold">All entered lectures are done.</p>
          ) : (
            <>
              <div className="text-xs font-bold uppercase tracking-wide text-ink-3">Lectures finish on</div>
              <div className={`tnum text-3xl font-bold ${fc.onTime === false ? 'text-bad' : ''}`}>{fc.finish ? fmtDate(fc.finish) : 'No pace yet'}</div>
              <p className="mt-1 text-[13px] text-ink-2">
                {fc.finish ? `At ${fc.lecturesPerDay.toFixed(1)} lectures a day.` : 'No lectures completed in the last 14 days.'} {fc.onTime === false ? 'That is after the exam.' : ''}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t-2 border-ink pt-3 text-[13px]">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-ink-3">Needed</div>
                  <div className="tnum font-bold">{fmtHM(fc.neededMinPerDay)}/day</div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-ink-3">You average</div>
                  <div className="tnum font-bold">{fmtHM(fc.avgMinPerDay)}/day</div>
                </div>
              </div>
              <p className="mt-2 text-xs text-ink-3">“Needed” is lecture time only, to finish {fc.lecturesLeft} lectures by the exam. It leaves no room for revision, so aim higher.</p>
            </>
          )}
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
        <Card title="What needs attention" className="lg:col-span-1" action={<Link to="/backlog" className="text-sm font-bold text-accent underline">Backlog →</Link>}>
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
