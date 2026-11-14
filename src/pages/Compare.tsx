import { useEffect, useMemo, useState } from 'react'
import { Bars, HBars, Lines, type Series } from '../components/charts'
import { Badge, Button, Card, Empty, Field, PageHeader, pct, useToast, cx } from '../components/ui'
import { seriesDaily, seriesWeekly, summarize, type Summary } from '../lib/analytics'
import { backend } from '../lib/backend'
import { addDays, fmtDate, fmtHM, fmtShort, today } from '../lib/dates'
import { useStore } from '../lib/store'
import type { Data } from '../lib/types'

const avgScore = (d: Data) => {
  const s = d.tests.filter((t) => t.totalMarks > 0)
  return s.length ? s.reduce((a, t) => a + (100 * t.marks) / t.totalMarks, 0) / s.length : null
}

export function LinkFriend() {
  const { user, refreshFriends } = useStore()
  const toast = useToast()
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const link = async () => {
    if (!user || !code.trim()) return
    setErr('')
    setBusy(true)
    try {
      await backend.linkFriend(user.id, code)
      await refreshFriends()
      setCode('')
      toast('Friend linked')
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-ink-2">Your friend code</span>
        <code className="tnum rounded-lg bg-surface-2 px-3 py-1.5 text-base font-semibold tracking-widest">{user?.code}</code>
        <Button size="sm" onClick={() => void navigator.clipboard?.writeText(user?.code ?? '').then(() => toast('Code copied'))}>
          Copy
        </Button>
      </div>
      <p className="mt-2 text-[13px] text-ink-3">Your friend creates their own account, then either of you enters the other's code. Linking lets each of you see the other's progress. Neither can edit the other's data.</p>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <Field label="Friend's code" className="w-44">
          <input className="inp uppercase tracking-widest" maxLength={8} value={code} onChange={(e) => setCode(e.target.value)} />
        </Field>
        <Button variant="primary" disabled={busy || !code.trim()} onClick={() => void link()}>
          Link friend
        </Button>
      </div>
      {err && (
        <p role="alert" className="mt-3 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
          {err}
        </p>
      )}
    </div>
  )
}

export default function Compare() {
  const { user, data, sum, friends, friendData, refreshFriends } = useStore()
  const t = today()
  const [fid, setFid] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    refreshFriends()
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [refreshFriends])
  // Realtime pushes changes when the connection allows it; this refresh keeps the comparison current when it does not.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') void refreshFriends().catch(() => {})
    }
    const id = setInterval(tick, 15000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [refreshFriends])
  const friend = friends.find((f) => f.id === fid) ?? friends[0]
  const fd = friend ? friendData[friend.id] : undefined
  const fs: Summary | null = useMemo(() => (fd ? summarize(fd, t) : null), [fd, t])

  if (!friend)
    return (
      <>
        <PageHeader title="Compare with Friend" sub="Side-by-side progress, updated live as either of you logs." />
        <Card title="Link a friend">{loading ? <p className="text-sm text-ink-3">Checking for linked friends…</p> : <LinkFriend />}</Card>
      </>
    )
  if (!fs || !fd)
    return (
      <>
        <PageHeader title="Compare with Friend" />
        <Card>
          <p className="text-sm text-ink-3">Loading {friend.name}'s data…</p>
        </Card>
      </>
    )

  const me = user?.name ?? 'Me'
  const SER: Series[] = [
    { key: 'me', label: me, color: 'var(--s1)' },
    { key: 'friend', label: friend.name, color: 'var(--s2)' },
  ]
  const from = addDays(t, -29)
  const md = seriesDaily(data.sessions, from, t)
  const fdaily = seriesDaily(fd.sessions, from, t)
  const daily = md.map((d, i) => ({ date: d.date, me: d.total / 60, friend: fdaily[i].total / 60 }))
  let cm = data.sessions.filter((s) => s.date < from).reduce((a, s) => a + s.durationMin, 0)
  let cf = fd.sessions.filter((s) => s.date < from).reduce((a, s) => a + s.durationMin, 0)
  const cumulative = md.map((d, i) => ({ date: d.date, me: (cm += d.total) / 60, friend: (cf += fdaily[i].total) / 60 }))
  const mw = seriesWeekly(data.sessions, 8, t)
  const fw = seriesWeekly(fd.sessions, 8, t)
  const weekly = mw.map((w, i) => ({ week: w.week, me: w.total / 60, friend: fw[i].total / 60 }))
  const ma = avgScore(data)
  const fa = avgScore(fd)

  // higher: true means a larger number is better.
  const rows: { label: string; a: number | null; b: number | null; fmt: (v: number) => string; higher: boolean }[] = [
    { label: 'Overall syllabus', a: sum.comp.overall, b: fs.comp.overall, fmt: (v) => `${v.toFixed(1)}%`, higher: true },
    { label: 'Group 1', a: sum.comp.g1, b: fs.comp.g1, fmt: (v) => `${v.toFixed(1)}%`, higher: true },
    { label: 'Group 2', a: sum.comp.g2, b: fs.comp.g2, fmt: (v) => `${v.toFixed(1)}%`, higher: true },
    { label: 'Revision', a: sum.comp.revision, b: fs.comp.revision, fmt: (v) => `${v.toFixed(1)}%`, higher: true },
    { label: 'Total study time', a: sum.totals.total, b: fs.totals.total, fmt: fmtHM, higher: true },
    { label: 'Last 7 days', a: sum.last7.total, b: fs.last7.total, fmt: fmtHM, higher: true },
    { label: 'Last 30 days', a: sum.last30.total, b: fs.last30.total, fmt: fmtHM, higher: true },
    { label: 'Active study days', a: sum.active, b: fs.active, fmt: String, higher: true },
    { label: 'Current streak (days)', a: sum.streak.current, b: fs.streak.current, fmt: String, higher: true },
    { label: 'Chapters completed', a: sum.completed, b: fs.completed, fmt: String, higher: true },
    { label: 'Average test score', a: ma, b: fa, fmt: pct, higher: true },
    { label: 'Lectures behind pace', a: sum.lecturesBehind, b: fs.lecturesBehind, fmt: String, higher: false },
    { label: 'Backlog to clear', a: sum.backlogMin, b: fs.backlogMin, fmt: fmtHM, higher: false },
  ]
  const lead = (r: (typeof rows)[number]) => (r.a == null || r.b == null || r.a === r.b ? 0 : (r.a > r.b) === r.higher ? 1 : -1)
  const wins = rows.filter((r) => lead(r) === 1).length
  const losses = rows.filter((r) => lead(r) === -1).length
  const empty = <Empty title="Neither of you has logged study time in this period" />

  return (
    <>
      <PageHeader title="Compare with Friend" sub={`${friend.name}'s numbers refresh on their own within about 15 seconds. As of ${fmtDate(t)}.`}>
        {friends.length > 1 && (
          <select className="inp w-auto!" aria-label="Friend" value={friend.id} onChange={(e) => setFid(e.target.value)}>
            {friends.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        )}
      </PageHeader>

      <Card title="Head to head" sub={`${me} leads on ${wins} measure${wins === 1 ? '' : 's'}, ${friend.name} on ${losses}.`} pad={false}>
        <div className="overflow-x-auto px-5 pb-4 pt-2">
          <table className="tbl min-w-[520px]">
            <thead>
              <tr>
                <th>Measure</th>
                <th className="text-right!">{me}</th>
                <th className="text-right!">{friend.name}</th>
                <th>Ahead</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const l = lead(r)
                return (
                  <tr key={r.label}>
                    <td className="text-ink-2">{r.label}</td>
                    <td className={cx('tnum text-right', l === 1 && 'font-semibold')}>{r.a == null ? '—' : r.fmt(r.a)}</td>
                    <td className={cx('tnum text-right', l === -1 && 'font-semibold')}>{r.b == null ? '—' : r.fmt(r.b)}</td>
                    <td>{l === 0 ? <span className="text-ink-3">Level</span> : <Badge tone={l === 1 ? 'good' : 'warn'}>{l === 1 ? me : friend.name}</Badge>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Daily study hours" sub="Last 30 days">
          <Lines data={daily} xKey="date" series={SER} fmtX={fmtShort} fmtLabel={fmtDate} empty={empty} />
        </Card>
        <Card title="Cumulative study hours" sub="Running total; the gap between the lines is the lead">
          <Lines data={cumulative} xKey="date" series={SER} fmtX={fmtShort} fmtLabel={fmtDate} empty={empty} />
        </Card>
        <Card title="Weekly study hours" sub="Last 8 weeks">
          <Bars data={weekly} xKey="week" series={SER} fmtX={fmtShort} fmtLabel={(w) => `Week of ${fmtDate(w)}`} empty={empty} />
        </Card>
        <Card title="Syllabus completion by subject" sub={`Top bar ${me}, bottom bar ${friend.name}`}>
          <HBars
            max={100}
            fmt={pct}
            rows={sum.ss.map((s) => ({ key: s.subject.id, label: s.subject.short, value: s.completion, color: 'var(--s1)', value2: fs.ss.find((x) => x.subject.id === s.subject.id)?.completion ?? 0, color2: 'var(--s2)' }))}
            empty={<Empty title="No syllabus progress recorded by either of you yet" />}
          />
        </Card>
        <Card title="Where each of you is behind" className="lg:col-span-2">
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              { name: me, s: sum },
              { name: friend.name, s: fs },
            ].map(({ name, s }) => (
              <div key={name}>
                <h3 className="mb-2 text-sm font-semibold">{name}</h3>
                {s.backlog.length === 0 ? (
                  <p className="text-sm text-ink-3">No backlog recorded.</p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {s.backlog.slice(0, 6).map((b) => (
                      <li key={b.key} className="flex justify-between gap-3">
                        <span className="truncate">{b.title}</span>
                        <span className="tnum shrink-0 text-ink-3">{fmtHM(b.minutes)}</span>
                      </li>
                    ))}
                    {s.backlog.length > 6 && <li className="text-xs text-ink-3">and {s.backlog.length - 6} more</li>}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}
