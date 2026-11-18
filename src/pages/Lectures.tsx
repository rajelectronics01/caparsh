import { Fragment, useState } from 'react'
import { HBars } from '../components/charts'
import { LectureChecklist, type ChapterChoice } from '../components/LectureChecklist'
import { WatchOrder } from '../components/WatchOrder'
import { Badge, Button, Card, Dot, Empty, PageHeader, Progress, Seg, Stat, num, useToast } from '../components/ui'
import { markLecture } from '../lib/actions'
import type { ChapterStats } from '../lib/analytics'
import { fmtDate, fmtHM } from '../lib/dates'
import { LIST_INFO, planListImport, type ImportPlan, type ListKey } from '../lib/lectureLists'
import { useStore } from '../lib/store'
import type { Chapter, Lecture } from '../lib/types'

export default function Lectures() {
  const { sum, put, putMany, data } = useStore()
  const toast = useToast()
  const [open, setOpen] = useState<string | null>(sum.ss[0]?.subject.id ?? null)
  const [openCh, setOpenCh] = useState<string | null>(null)
  const [q, setQ] = useState('')
  // Per subject: by ICAI chapter, or in the order the faculty teaches (default when a lecture list is loaded).
  const [view, setView] = useState<Record<string, 'order' | 'chapters'>>({})
  const [report, setReport] = useState<{ key: ListKey; plan: ImportPlan } | null>(null)
  const total = sum.ss.reduce((a, s) => a + s.totalLectures, 0)
  const done = sum.ss.reduce((a, s) => a + s.lecturesDone, 0)
  const unset = sum.cs.filter((c) => c.totalLectures === 0).length
  const save = (c: Chapter) => put('chapters', c)
  const choices = (subjectId: string): ChapterChoice[] => sum.cs.filter((c) => c.chapter.subjectId === subjectId).sort((a, b) => a.chapter.order - b.chapter.order).map((c) => ({ id: c.chapter.id, name: c.chapter.name, ok: c.hasList || c.totalLectures === 0 }))
  // Move a lecture into another chapter of the same subject (the chapter it leaves has already been saved without it).
  const moveTo = (lecture: Lecture, toId: string) => {
    const target = data.chapters.find((c) => c.id === toId)
    if (!target) return
    const lectures = [...(target.lectures ?? []), lecture]
    put('chapters', { ...target, lectures, totalLectures: lectures.length })
    toast(`Moved to ${target.name}`)
  }

  const load = (key: ListKey) => {
    const plan = planListImport(data, key)
    if (!plan.chapters.length) return toast('Those chapters are not in this account, so nothing was loaded.', 'bad')
    putMany([...plan.chapters.map((c) => ({ collection: 'chapters' as const, id: c.id, data: c })), ...plan.subjects.map((s) => ({ collection: 'subjects' as const, id: s.id, data: s }))])
    setReport({ key, plan })
    setOpen(LIST_INFO[key].subjectId)
    toast(`Loaded ${plan.lectures} lectures into ${LIST_INFO[key].label}`)
  }
  const available = (Object.keys(LIST_INFO) as ListKey[]).filter((k) => data.subjects.some((s) => s.id === LIST_INFO[k].subjectId))
  const listLoaded = (k: ListKey) => sum.cs.some((c) => c.chapter.subjectId === LIST_INFO[k].subjectId && c.hasList)

  const expandable = (c: ChapterStats) => c.hasList || c.totalLectures === 0
  const counter = (c: ChapterStats, size: 'sm' | 'md') => (
    <div className="inline-flex items-center gap-1.5">
      <Button size={size} aria-label={`Remove a lecture from ${c.chapter.name}`} disabled={c.lecturesDone <= 0} onClick={() => save(markLecture(c.chapter, -1))}>
        −
      </Button>
      <span className="tnum min-w-12 text-center font-bold">
        {c.lecturesDone}/{c.totalLectures}
      </span>
      <Button size={size} variant="primary" aria-label={`Mark a lecture done for ${c.chapter.name}`} disabled={c.totalLectures > 0 && c.lecturesDone >= c.totalLectures} onClick={() => save(markLecture(c.chapter, 1))}>
        +
      </Button>
    </div>
  )
  const totalInput = (c: ChapterStats, cls: string) =>
    c.hasList ? (
      <span className="tnum text-sm">{c.totalLectures} listed</span>
    ) : (
      <input type="number" min="0" inputMode="numeric" aria-label={`Total lectures for ${c.chapter.name}`} className={`inp tnum ${cls}`} value={c.chapter.totalLectures || ''} placeholder="0" onChange={(e) => save({ ...c.chapter, totalLectures: Math.max(0, Math.round(num(e.target.value))) })} />
    )
  const toggle = (c: ChapterStats) =>
    expandable(c) ? (
      <Button size="sm" aria-expanded={openCh === c.chapter.id} aria-label={`Lectures of ${c.chapter.name}`} onClick={() => setOpenCh(openCh === c.chapter.id ? null : c.chapter.id)}>
        {openCh === c.chapter.id ? 'Hide lectures' : c.hasList ? 'Lectures ▸' : 'Add lectures'}
      </Button>
    ) : null

  return (
    <>
      <PageHeader title="Lecture Tracker" sub="Tick lectures off as you watch them. Time left is worked out from each lecture's length." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Total lectures" value={total} hint={unset ? `${unset} chapters have none listed` : undefined} />
        <Stat label="Watched" value={done} />
        <Stat label="Remaining" value={sum.lecturesLeft} />
        <Stat label="Time left to watch" value={fmtHM(sum.lecturesRemainingMin)} />
        <Stat label="Behind pace" value={sum.lecturesBehind} tone={sum.lecturesBehind ? 'warn' : undefined} hint="vs your target dates" />
      </div>

      {available.length > 0 && (
        <Card className="mt-4" title="Your lecture lists" sub="Load the faculty's recorded lectures with their real lengths. Running it again keeps what you have ticked.">
          <div className="flex flex-wrap gap-2">
            {available.map((k) => (
              <Button key={k} className="h-auto min-h-10 w-full whitespace-normal py-2 text-center sm:w-auto" variant={listLoaded(k) ? 'soft' : 'primary'} onClick={() => load(k)}>
                {listLoaded(k) ? 'Reload' : 'Load'} {LIST_INFO[k].label} ({LIST_INFO[k].faculty})
              </Button>
            ))}
          </div>
          {report && (
            <div className="mt-4 space-y-1.5 border-2 border-ink bg-[var(--p4)] p-3 text-sm text-[var(--on-color)]" role="status">
              <p className="font-bold">
                Loaded {report.plan.lectures} lectures ({fmtHM(report.plan.minutes)}) into {LIST_INFO[report.key].label}.
              </p>
              {report.plan.notes.map((n) => (
                <p key={n}>{n}</p>
              ))}
              {report.plan.created.length > 0 && <p>Added chapter: {report.plan.created.join(', ')}.</p>}
              {report.plan.untouched.length > 0 && <p>No lectures in your list for: {report.plan.untouched.join('; ')}. They stay at 0 until you add lectures or delete the chapter.</p>}
              {report.plan.mismatches.length > 0 && <p>The platform shows more lectures than were in the list for: {report.plan.mismatches.map((m) => `${m.name} (${m.listed} of ${m.platform})`).join('; ')}. Use “Add lectures” on those chapters for the missing ones.</p>}
              {report.plan.skipped.length > 0 && <p>Left out (not a syllabus lecture): {report.plan.skipped.join('; ')}.</p>}
              {report.plan.missing.length > 0 && <p>Not found in this account, so skipped: {report.plan.missing.join(', ')}.</p>}
            </div>
          )}
        </Card>
      )}

      <Card className="mt-4" title="Subject-wise lecture backlog" sub="Lectures still to watch per subject">
        <HBars fmt={(v) => `${v}`} rows={sum.ss.map((s) => ({ key: s.subject.id, label: s.subject.short, value: s.lecturesLeft, color: `var(--s${s.subject.slot})`, note: `≈ ${fmtHM(s.remainingMin)}` }))} empty={<Empty title="No pending lectures to show">Load your lecture list above, or enter the total lectures for each chapter below.</Empty>} />
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
                  {s.lecturesDone}/{s.totalLectures} watched · {s.lecturesLeft} left
                </span>
                <span className="tnum text-sm text-ink-3">
                  {s.listedLectures > 0 ? `${fmtHM(s.listedMinutes)} listed · ` : ''}avg {fmtHM(s.avgLectureMin)}/lecture ({s.listedLectures > 0 ? 'from the list' : s.avgIsMeasured ? 'from your log' : 'estimate'}) · ≈ {fmtHM(s.remainingMin)} left to watch
                </span>
                {s.locked && <Badge tone="accent">Starts after {s.startsAfterName}</Badge>}
                {s.behind > 0 && <Badge tone="warn">{s.behind} behind pace</Badge>}
                {s.subject.lectureTargetDate && <span className="text-xs text-ink-3">target {fmtDate(s.subject.lectureTargetDate)}</span>}
                <span className="ml-auto text-ink-3">{isOpen ? '▾' : '▸'}</span>
              </button>
              {isOpen && s.listedLectures > 0 && (
                <div className="flex items-center justify-between gap-2 border-t-2 border-ink px-4 pt-3">
                  <span className="text-xs font-bold uppercase tracking-wide text-ink-3">View</span>
                  <Seg
                    value={view[s.subject.id] ?? 'order'}
                    onChange={(v) => setView({ ...view, [s.subject.id]: v })}
                    options={[
                      { id: 'order', label: 'Watching order' },
                      { id: 'chapters', label: 'By chapter' },
                    ]}
                  />
                </div>
              )}
              {isOpen && s.listedLectures > 0 && (view[s.subject.id] ?? 'order') === 'order' && !q && <WatchOrder chapters={s.chapters.map((c) => c.chapter)} onChange={save} />}
              {isOpen && (s.listedLectures === 0 || (view[s.subject.id] ?? 'order') === 'chapters' || !!q) && (
                <div className="overflow-x-auto border-t-2 border-ink">
                  <ul className="divide-y divide-line md:hidden">
                    {rows.map((c) => (
                      <li key={c.chapter.id} className="space-y-2 px-4 py-3">
                        <div className="text-sm font-bold">{c.chapter.name}</div>
                        <Progress value={c.lecturePct} color={`var(--s${s.subject.slot})`} />
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label className="inline-flex items-center gap-2 text-xs font-bold uppercase">
                            Total
                            {totalInput(c, 'w-16! min-h-10! py-1!')}
                          </label>
                          {counter(c, 'md')}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="tnum text-xs text-ink-3">{c.lecturesLeft > 0 ? `${c.lecturesLeft} left · ≈ ${fmtHM(c.remainingMin ?? c.lecturesLeft * s.avgLectureMin)}` : c.totalLectures > 0 ? 'All watched' : ''}</span>
                          {toggle(c)}
                        </div>
                        {openCh === c.chapter.id && <LectureChecklist chapter={c.chapter} onChange={save} chapters={choices(s.subject.id)} onMoveTo={moveTo} />}
                      </li>
                    ))}
                  </ul>
                  <table className="tbl hidden min-w-[760px] md:table">
                    <thead>
                      <tr>
                        <th>Chapter</th>
                        <th>Lectures</th>
                        <th>Watched</th>
                        <th>Left</th>
                        <th>Time left</th>
                        <th className="w-36">Progress</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((c) => (
                        <Fragment key={c.chapter.id}>
                          <tr>
                            <td className="max-w-[280px]">{c.chapter.name}</td>
                            <td>{totalInput(c, 'w-20! min-h-8! py-1!')}</td>
                            <td className="whitespace-nowrap">
                              {counter(c, 'sm')}
                              {c.lecturesLeft > 0 && !c.hasList && (
                                <Button size="sm" variant="ghost" onClick={() => save(markLecture(c.chapter, c.lecturesLeft))}>
                                  All
                                </Button>
                              )}
                            </td>
                            <td className="tnum">{c.lecturesLeft}</td>
                            <td className="tnum text-ink-2">{c.lecturesLeft ? fmtHM(c.remainingMin ?? c.lecturesLeft * s.avgLectureMin) : '—'}</td>
                            <td>
                              <Progress value={c.lecturePct} color={`var(--s${s.subject.slot})`} className="h-1.5!" />
                            </td>
                            <td className="text-right">{toggle(c)}</td>
                          </tr>
                          {openCh === c.chapter.id && (
                            <tr>
                              <td colSpan={7} className="bg-surface-2">
                                <LectureChecklist chapter={c.chapter} onChange={save} chapters={choices(s.subject.id)} onMoveTo={moveTo} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
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
