import { useMemo, useState } from 'react'
import { SessionForm, useSubjects } from '../components/SessionForm'
import { Badge, Button, Card, Check, ConfirmButton, Dot, Empty, Field, PageHeader, Seg, Stat } from '../components/ui'
import { totals } from '../lib/analytics'
import { addDays, dow, fmtDate, fmtDay, fmtHM, today } from '../lib/dates'
import { useStore } from '../lib/store'
import { ACTIVITIES, activityLabel, type DayInfo, type DayType, type Session } from '../lib/types'

export function SessionTable({ rows, onEdit, showDate }: { rows: Session[]; onEdit: (s: Session) => void; showDate?: boolean }) {
  const { del } = useStore()
  const { subject, chapter } = useSubjects()
  return (
    <div className="overflow-x-auto">
      <table className="tbl min-w-[720px]">
        <thead>
          <tr>
            {showDate && <th>Date</th>}
            <th>Time</th>
            <th>Subject</th>
            <th>Chapter / topic</th>
            <th>Activity</th>
            <th className="text-right!">Duration</th>
            <th className="text-right!">Questions</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const sub = subject(s.subjectId)
            return (
              <tr key={s.id}>
                {showDate && <td className="tnum whitespace-nowrap">{fmtDate(s.date)}</td>}
                <td className="tnum whitespace-nowrap text-ink-2">{s.start ? `${s.start}–${s.end}` : '—'}</td>
                <td>
                  <span className="inline-flex items-center gap-2 whitespace-nowrap">
                    <Dot slot={sub?.slot ?? 1} />
                    {sub?.short ?? 'Deleted subject'}
                  </span>
                </td>
                <td className="max-w-[260px]">
                  <div className="truncate">{chapter(s.chapterId)?.name ?? '—'}</div>
                  {(s.topic || s.notes) && <div className="truncate text-xs text-ink-3">{[s.topic, s.notes].filter(Boolean).join(' · ')}</div>}
                </td>
                <td className="whitespace-nowrap">
                  {activityLabel(s.activity)}
                  {s.lecturesCompleted ? <span className="text-ink-3"> · {s.lecturesCompleted} lec</span> : null}
                  {s.status === 'partial' && (
                    <span className="ml-2">
                      <Badge tone="warn">Partial</Badge>
                    </span>
                  )}
                </td>
                <td className="tnum text-right font-medium">{fmtHM(s.durationMin)}</td>
                <td className="tnum text-right text-ink-2">{s.qAttempted ? (s.qCorrect != null ? `${s.qCorrect}/${s.qAttempted} correct` : `${s.qAttempted} attempted`) : '—'}</td>
                <td className="whitespace-nowrap text-right">
                  <Button size="sm" variant="ghost" onClick={() => onEdit(s)}>
                    Edit
                  </Button>
                  <ConfirmButton onConfirm={() => del('sessions', s.id)} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function DailyLog() {
  const { data, put } = useStore()
  const { subjects } = useSubjects()
  const [tab, setTab] = useState<'day' | 'all'>('day')
  const [date, setDate] = useState(today())
  const [form, setForm] = useState<Partial<Session> | null>(null)
  const [q, setQ] = useState('')
  const [fs, setFs] = useState('')
  const [fa, setFa] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const daySessions = useMemo(() => data.sessions.filter((s) => s.date === date).sort((a, b) => (a.start ?? '99').localeCompare(b.start ?? '99')), [data.sessions, date])
  const t = totals(daySessions)
  const info: DayInfo = data.days.find((d) => d.id === date) ?? { id: date, college: data.settings.collegeDays.includes(dow(date)), office: false, semExam: false, dayType: 'normal' }
  const saved = data.days.some((d) => d.id === date)
  const setInfo = (patch: Partial<DayInfo>) => put('days', { ...info, ...patch })
  const bySubject = subjects.map((s) => ({ s, min: daySessions.filter((x) => x.subjectId === s.id).reduce((a, x) => a + x.durationMin, 0) })).filter((x) => x.min > 0)
  const target = data.settings.dailyTargetHours[info.dayType]

  const all = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return data.sessions
      .filter((s) => (!fs || s.subjectId === fs) && (!fa || s.activity === fa) && (!from || s.date >= from) && (!to || s.date <= to))
      .filter((s) => {
        if (!needle) return true
        const ch = data.chapters.find((c) => c.id === s.chapterId)?.name ?? ''
        return `${ch} ${s.topic ?? ''} ${s.notes ?? ''}`.toLowerCase().includes(needle)
      })
      .sort((a, b) => b.date.localeCompare(a.date) || (b.start ?? '').localeCompare(a.start ?? ''))
  }, [data.sessions, data.chapters, q, fs, fa, from, to])

  return (
    <>
      <PageHeader title="Daily Study Log" sub="Every session you study, with accurate durations.">
        <Seg value={tab} onChange={setTab} options={[{ id: 'day', label: 'Day view' }, { id: 'all', label: 'All sessions' }]} />
        <Button variant="primary" onClick={() => setForm({ date: tab === 'day' ? date : today() })}>
          + Log session
        </Button>
      </PageHeader>

      {tab === 'day' ? (
        <>
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <Button aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}>
                ←
              </Button>
              <input type="date" aria-label="Date" className="inp w-auto!" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
              <Button aria-label="Next day" onClick={() => setDate(addDays(date, 1))}>
                →
              </Button>
              <Button variant="ghost" onClick={() => setDate(today())}>
                Today
              </Button>
              <span className="ml-1 text-sm text-ink-2">
                {fmtDay(date)}, {fmtDate(date)}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-4">
              <Check label="College day" checked={info.college} onChange={(v) => setInfo({ college: v })} />
              <Check label="Office day" checked={info.office} onChange={(v) => setInfo({ office: v })} />
              <Check label="Semester exam day" checked={info.semExam} onChange={(v) => setInfo({ semExam: v, dayType: v ? 'exam' : info.dayType })} />
              <label className="inline-flex items-center gap-2 text-sm">
                Day type
                <select className="inp w-auto!" value={info.dayType} onChange={(e) => setInfo({ dayType: e.target.value as DayType })}>
                  <option value="normal">Normal</option>
                  <option value="busy">Busy</option>
                  <option value="exam">Exam</option>
                  <option value="holiday">Holiday</option>
                </select>
              </label>
              {!saved && <span className="text-xs text-ink-3">Defaults shown; change any to save this day.</span>}
            </div>
          </Card>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="Total studied" value={fmtHM(t.total)} hint={`Target ${target}h for a ${info.dayType} day`} tone={t.total >= target * 60 && t.total > 0 ? 'good' : undefined} />
            <Stat label="Lectures" value={fmtHM(t.lecture)} />
            <Stat label="Self-study" value={fmtHM(t.self)} />
            <Stat label="Practice" value={fmtHM(t.practice)} />
            <Stat label="Revision" value={fmtHM(t.revision)} />
          </div>
          {bySubject.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {bySubject.map(({ s, min }) => (
                <span key={s.id} className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm">
                  <Dot slot={s.slot} />
                  {s.short} <span className="tnum font-medium">{fmtHM(min)}</span>
                </span>
              ))}
            </div>
          )}
          <Card className="mt-4" title="Sessions" pad={false}>
            <div className="p-5 pt-3">
              {daySessions.length ? (
                <SessionTable rows={daySessions} onEdit={setForm} />
              ) : (
                <Empty title="No sessions on this day" action={<Button variant="primary" onClick={() => setForm({ date })}>+ Log session</Button>}>
                  A day only counts as an active study day once it has logged time.
                </Empty>
              )}
            </div>
          </Card>
        </>
      ) : (
        <Card pad={false}>
          <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Search">
              <input className="inp" placeholder="Chapter, topic or notes" value={q} onChange={(e) => setQ(e.target.value)} />
            </Field>
            <Field label="Subject">
              <select className="inp" value={fs} onChange={(e) => setFs(e.target.value)}>
                <option value="">All subjects</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.short}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Activity">
              <select className="inp" value={fa} onChange={(e) => setFa(e.target.value)}>
                <option value="">All activities</option>
                {ACTIVITIES.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="From">
              <input type="date" className="inp" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="To">
              <input type="date" className="inp" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
          <div className="border-t border-line px-5 py-3 text-sm text-ink-3">
            {all.length} session{all.length === 1 ? '' : 's'} · {fmtHM(all.reduce((a, s) => a + s.durationMin, 0))}
          </div>
          <div className="px-5 pb-5">
            {all.length ? <SessionTable rows={all.slice(0, 300)} onEdit={setForm} showDate /> : <Empty title={data.sessions.length ? 'No sessions match these filters' : 'No sessions logged yet'} />}
            {all.length > 300 && <p className="mt-3 text-xs text-ink-3">Showing the latest 300. Narrow the filters to see older sessions.</p>}
          </div>
        </Card>
      )}
      {form && <SessionForm initial={form} onClose={() => setForm(null)} />}
    </>
  )
}
