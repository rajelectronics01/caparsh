import { useEffect, useMemo, useState } from 'react'
import { HBars } from '../components/charts'
import { SessionLines } from '../components/SessionLines'
import { Badge, Button, Card, Empty, Field, PageHeader, Seg, useToast } from '../components/ui'
import { minutesBySubject, sessionsOn, summarize } from '../lib/analytics'
import { backend } from '../lib/backend'
import { addDays, fmtDate, fmtDay, fmtHM, timeToMin, today } from '../lib/dates'
import { useStore } from '../lib/store'

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

/** A day on a 24-hour line: one block per timed session, coloured by subject. */
function DayStrip({ sessions, subjects }: { sessions: ReturnType<typeof sessionsOn>; subjects: { id: string; slot: number; short: string }[] }) {
  const timed = sessions.filter((s) => s.start && s.end)
  return (
    <div>
      <div className="relative h-7 border-2 border-ink bg-surface-2" role="img" aria-label="Study times across the day">
        {[6, 12, 18].map((h) => (
          <span key={h} className="absolute inset-y-0 border-l border-dashed border-ink-3" style={{ left: `${(h / 24) * 100}%` }} />
        ))}
        {timed.map((s) => {
          const a = timeToMin(s.start!)
          let b = timeToMin(s.end!)
          if (b <= a) b = 1440 // crossing midnight: draw to the end of the day
          const sub = subjects.find((x) => x.id === s.subjectId)
          return <span key={s.id} title={`${sub?.short ?? ''} ${s.start}–${s.end}`} className="absolute inset-y-0 border-x border-ink" style={{ left: `${(a / 1440) * 100}%`, width: `${Math.max(0.8, ((b - a) / 1440) * 100)}%`, background: `var(--s${sub?.slot ?? 1})` }} />
        })}
      </div>
      <div className="tnum mt-0.5 flex justify-between text-[10px] text-ink-3">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
    </div>
  )
}

type Range = 'today' | '7' | '30' | 'all'

export default function Compare() {
  const { user, data, sum, friends, friendData, refreshFriends } = useStore()
  const t = today()
  const [fid, setFid] = useState('')
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<Range>('7')
  const [date, setDate] = useState(t)
  useEffect(() => {
    refreshFriends()
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [refreshFriends])
  // Realtime pushes changes when the connection allows it; this keeps the screen current when it does not.
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
  const fs = useMemo(() => (fd ? summarize(fd, t) : null), [fd, t])

  if (!friend)
    return (
      <>
        <PageHeader title="Compare" sub="You and a friend, side by side." />
        <Card title="Link a friend">{loading ? <p className="text-sm text-ink-3">Checking for linked friends…</p> : <LinkFriend />}</Card>
      </>
    )
  if (!fs || !fd)
    return (
      <>
        <PageHeader title="Compare" />
        <Card>
          <p className="text-sm text-ink-3">Loading {friend.name}&apos;s data…</p>
        </Card>
      </>
    )

  const me = user?.name ?? 'Me'
  const from = range === 'today' ? t : range === '7' ? addDays(t, -6) : range === '30' ? addDays(t, -29) : '0000-01-01'
  const mine = minutesBySubject(data, from, t)
  const theirs = minutesBySubject(fd, from, t)
  const rows = mine
    .map((m, i) => ({ subject: m.subject, a: m.minutes, b: theirs.find((x) => x.subject.id === m.subject.id)?.minutes ?? 0, i }))
    .filter((r) => r.a > 0 || r.b > 0)
  const totalA = rows.reduce((x, r) => x + r.a, 0)
  const totalB = rows.reduce((x, r) => x + r.b, 0)

  const logA = sessionsOn(data, date)
  const logB = sessionsOn(fd, date)
  const sumMin = (l: typeof logA) => l.reduce((a, s) => a + s.durationMin, 0)
  const lecturesDone = (s: typeof sum) => s.lecturesTotalDone
  const cards = [
    { name: me, you: true, s: sum, today: sumMin(sessionsOn(data, t)), color: 'var(--p1)', bar: 'var(--pink)' },
    { name: friend.name, you: false, s: fs, today: sumMin(sessionsOn(fd, t)), color: 'var(--p3)', bar: 'var(--p2)' },
  ]
  const lead = cards[0].s.last7.total === cards[1].s.last7.total ? null : cards[0].s.last7.total > cards[1].s.last7.total ? 0 : 1
  const legend = (
    <div className="mb-3 flex flex-wrap gap-4 text-[12.5px] font-bold uppercase">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 border-2 border-ink" style={{ background: 'var(--pink)' }} />
        {me}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 border-2 border-ink" style={{ background: 'var(--p3)' }} />
        {friend.name}
      </span>
    </div>
  )

  return (
    <>
      <PageHeader title="Compare" sub={`You and ${friend.name}. Updates by itself every 15 seconds.`}>
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

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c, i) => (
          <section key={i} className="hard border-2 border-ink p-4 text-[var(--on-color)]" style={{ background: c.color }}>
            <div className="flex items-start justify-between gap-2">
              <h2 className="truncate text-lg font-bold">
                {c.name}
                {c.you ? ' (you)' : ''}
              </h2>
              {lead === i && <Badge tone="good">Ahead this week</Badge>}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3">
              {[
                ['Today', fmtHM(c.today)],
                ['Last 7 days', fmtHM(c.s.last7.total)],
                ['Streak', `${c.s.streak.current} ${c.s.streak.current === 1 ? 'day' : 'days'}`],
                ['Syllabus', `${c.s.comp.overall.toFixed(1)}%`],
                ['Lectures done', `${lecturesDone(c.s)}`],
                ['Behind pace', `${c.s.lecturesBehind}`],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[11px] font-bold uppercase tracking-wide opacity-75">{k}</dt>
                  <dd className="tnum text-xl font-bold">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <Card className="mt-4" title="Hours by subject" sub={`${me} ${fmtHM(totalA)} · ${friend.name} ${fmtHM(totalB)}`} action={<Seg value={range} onChange={setRange} options={[{ id: 'today', label: 'Today' }, { id: '7', label: '7 days' }, { id: '30', label: '30 days' }, { id: 'all', label: 'All' }]} />}>
        {legend}
        <HBars
          fmt={fmtHM}
          rows={rows.map((r) => ({ key: r.subject.id, label: r.subject.short, value: r.a, color: 'var(--pink)', value2: r.b, color2: 'var(--p3)' }))}
          empty={<Empty title="No study logged in this period">Neither of you has logged time for {range === 'today' ? 'today' : 'this range'} yet.</Empty>}
        />
      </Card>

      <Card className="mt-4" title="Study log" sub="Who studied what, and when">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}>
            ←
          </Button>
          <input type="date" aria-label="Date" className="inp w-auto!" value={date} max={t} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <Button aria-label="Next day" disabled={date >= t} onClick={() => setDate(addDays(date, 1))}>
            →
          </Button>
          {date !== t && (
            <Button variant="ghost" onClick={() => setDate(t)}>
              Today
            </Button>
          )}
          <span className="text-sm font-bold">
            {fmtDay(date)}, {fmtDate(date)}
          </span>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {[
            { name: me + ' (you)', d: data, log: logA },
            { name: friend.name, d: fd, log: logB },
          ].map((c) => (
            <div key={c.name}>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h3 className="truncate text-sm font-bold">{c.name}</h3>
                <span className="tnum text-lg font-bold">{fmtHM(sumMin(c.log))}</span>
              </div>
              <DayStrip sessions={c.log} subjects={c.d.subjects} />
              <div className="mt-3">
                <SessionLines sessions={c.log} subjects={c.d.subjects} chapters={c.d.chapters} empty="Nothing logged this day." />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}
