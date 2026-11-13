import { useState } from 'react'
import { HBars } from '../components/charts'
import { Badge, Button, Card, Dot, Empty, PageHeader, Progress, Stat, num } from '../components/ui'
import { markLecture } from '../lib/actions'
import { fmtDate, fmtHM } from '../lib/dates'
import { useStore } from '../lib/store'

export default function Lectures() {
  const { sum, put } = useStore()
  const [open, setOpen] = useState<string | null>(sum.ss[0]?.subject.id ?? null)
  const [q, setQ] = useState('')
  const total = sum.ss.reduce((a, s) => a + s.totalLectures, 0)
  const done = sum.ss.reduce((a, s) => a + s.lecturesDone, 0)
  const unset = sum.cs.filter((c) => c.chapter.totalLectures === 0).length

  return (
    <>
      <PageHeader title="Lecture Tracker" sub="Lecture counts are yours to enter: every faculty's batch is different." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Total lectures" value={total} hint={unset ? `${unset} chapters have no count yet` : undefined} />
        <Stat label="Completed" value={done} />
        <Stat label="Remaining" value={sum.lecturesLeft} />
        <Stat label="Est. hours remaining" value={fmtHM(sum.lecturesRemainingMin)} />
        <Stat label="Behind pace" value={sum.lecturesBehind} tone={sum.lecturesBehind ? 'warn' : undefined} hint="vs your target dates" />
      </div>

      <Card className="mt-4" title="Subject-wise lecture backlog" sub="Lectures still to watch per subject">
        <HBars fmt={(v) => `${v}`} rows={sum.ss.map((s) => ({ key: s.subject.id, label: s.subject.short, value: s.lecturesLeft, color: `var(--s${s.subject.slot})`, note: `≈ ${fmtHM(s.remainingMin)}` }))} empty={<Empty title="No pending lectures to show">Enter the total lectures for each chapter below and they will appear here.</Empty>} />
      </Card>

      <div className="mt-4 mb-3">
        <input className="inp sm:max-w-xs" placeholder="Search chapters" aria-label="Search chapters" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="space-y-3">
        {sum.ss.map((s) => {
          const rows = s.chapters.filter((c) => c.chapter.name.toLowerCase().includes(q.trim().toLowerCase()))
          const isOpen = open === s.subject.id || !!q
          if (q && rows.length === 0) return null
          return (
            <Card key={s.subject.id} pad={false}>
              <button className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 text-left" onClick={() => setOpen(isOpen ? null : s.subject.id)} aria-expanded={isOpen}>
                <span className="inline-flex min-w-40 items-center gap-2 font-semibold">
                  <Dot slot={s.subject.slot} />
                  {s.subject.name}
                </span>
                <span className="tnum text-sm text-ink-2">
                  {s.lecturesDone}/{s.totalLectures} done · {s.lecturesLeft} left
                </span>
                <span className="tnum text-sm text-ink-3">
                  avg {fmtHM(s.avgLectureMin)}/lecture ({s.avgIsMeasured ? 'from your log' : 'estimate'}) · {fmtHM(s.lectureMin)} watched · ≈ {fmtHM(s.remainingMin)} left
                </span>
                {s.behind > 0 && <Badge tone="warn">{s.behind} behind pace</Badge>}
                {s.subject.lectureTargetDate && <span className="text-xs text-ink-3">target {fmtDate(s.subject.lectureTargetDate)}</span>}
                <span className="ml-auto text-ink-3">{isOpen ? '▾' : '▸'}</span>
              </button>
              {isOpen && (
                <div className="overflow-x-auto border-t border-line">
                  <table className="tbl min-w-[640px]">
                    <thead>
                      <tr>
                        <th>Chapter</th>
                        <th>Total lectures</th>
                        <th>Completed</th>
                        <th>Remaining</th>
                        <th>Est. time left</th>
                        <th className="w-40">Progress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((c) => (
                        <tr key={c.chapter.id}>
                          <td className="max-w-[280px]">{c.chapter.name}</td>
                          <td>
                            <input type="number" min="0" aria-label={`Total lectures for ${c.chapter.name}`} className="inp tnum w-20! min-h-8! py-1!" value={c.chapter.totalLectures || ''} placeholder="0" onChange={(e) => put('chapters', { ...c.chapter, totalLectures: Math.max(0, Math.round(num(e.target.value))) })} />
                          </td>
                          <td className="whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <Button size="sm" aria-label={`Remove a lecture from ${c.chapter.name}`} disabled={c.lecturesDone <= 0} onClick={() => put('chapters', markLecture(c.chapter, -1))}>
                                −
                              </Button>
                              <span className="tnum min-w-8 text-center">{c.lecturesDone}</span>
                              <Button size="sm" aria-label={`Mark a lecture done for ${c.chapter.name}`} disabled={c.chapter.totalLectures > 0 && c.lecturesDone >= c.chapter.totalLectures} onClick={() => put('chapters', markLecture(c.chapter, 1))}>
                                +
                              </Button>
                              {c.lecturesLeft > 0 && (
                                <Button size="sm" variant="ghost" onClick={() => put('chapters', markLecture(c.chapter, c.lecturesLeft))}>
                                  All done
                                </Button>
                              )}
                            </div>
                          </td>
                          <td className="tnum">{c.lecturesLeft}</td>
                          <td className="tnum text-ink-2">{c.lecturesLeft ? fmtHM(c.lecturesLeft * s.avgLectureMin) : '—'}</td>
                          <td>
                            <Progress value={c.lecturePct} color={`var(--s${s.subject.slot})`} className="h-1.5!" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </>
  )
}
