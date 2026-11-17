import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSubjects } from '../components/SessionForm'
import { Badge, Button, Card, ConfirmButton, Dot, Empty, Field, Modal, num, PageHeader, Progress, statusTone, useToast, cx } from '../components/ui'
import { markLecture } from '../lib/actions'
import type { ChapterStats, ChapterStatus } from '../lib/analytics'
import { newChapter } from '../lib/seed'
import { useStore } from '../lib/store'
import type { Chapter } from '../lib/types'

const STATUSES: ChapterStatus[] = ['Not Started', 'In Progress', 'Lectures Completed']

function ChapterForm({ ch, isNew, onClose }: { ch: Chapter; isNew: boolean; onClose: () => void }) {
  const { put } = useStore()
  const toast = useToast()
  const [f, setF] = useState({ name: ch.name, total: String(ch.totalLectures || '') })
  const [err, setErr] = useState('')
  const save = () => {
    if (!f.name.trim()) return setErr('Chapter name is required.')
    if (num(f.total) < 0) return setErr('The lecture count cannot be negative.')
    put('chapters', { ...ch, name: f.name.trim(), totalLectures: Math.round(num(f.total)) })
    toast(isNew ? 'Chapter added' : 'Chapter updated')
    onClose()
  }
  return (
    <Modal title={isNew ? 'Add chapter' : 'Edit chapter'} onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Chapter name" className="sm:col-span-2">
          <input className="inp" autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Total lectures" hint="As per your faculty's batch." className="sm:col-span-2">
          <input type="number" min="0" className="inp" value={f.total} onChange={(e) => setF({ ...f, total: e.target.value })} />
        </Field>
      </div>
      {err && (
        <p role="alert" className="mt-4 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
          {err}
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save}>
          Save
        </Button>
      </div>
    </Modal>
  )
}

export default function Syllabus() {
  const { sum, put, putMany, del } = useStore()
  const { subjects } = useSubjects()
  const [params, setParams] = useSearchParams()
  const sid = params.get('s') && subjects.some((s) => s.id === params.get('s')) ? params.get('s')! : (subjects[0]?.id ?? '')
  const [q, setQ] = useState('')
  const [fst, setFst] = useState('')
  const [edit, setEdit] = useState<{ ch: Chapter; isNew: boolean } | null>(null)
  const ss = sum.ss.find((s) => s.subject.id === sid)
  const rows = useMemo(() => (ss?.chapters ?? []).filter((c) => (!fst || c.status === fst) && c.chapter.name.toLowerCase().includes(q.trim().toLowerCase())), [ss, q, fst])

  const move = (c: ChapterStats, dir: -1 | 1) => {
    const list = ss!.chapters.map((x) => x.chapter)
    const i = list.findIndex((x) => x.id === c.chapter.id)
    const j = i + dir
    if (j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    putMany(list.flatMap((ch, order) => (ch.order === order ? [] : [{ collection: 'chapters' as const, id: ch.id, data: { ...ch, order } }])))
  }
  const filtered = !!q || !!fst

  return (
    <>
      <PageHeader title="Syllabus Tracker" sub="Tick lectures off as you watch them. Chapters are tracked by lectures for now.">
        <Button variant="primary" onClick={() => setEdit({ ch: newChapter(sid, '', ss?.chapters.length ?? 0), isNew: true })}>
          + Add chapter
        </Button>
      </PageHeader>

      <div className="mb-4 grid grid-cols-4 gap-2 sm:flex sm:flex-wrap">
        {sum.ss.map((s) => (
          <button key={s.subject.id} onClick={() => setParams({ s: s.subject.id })} className={cx('press inline-flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 border-2 px-1 text-[12px] font-bold uppercase sm:flex-row sm:gap-2 sm:px-3 sm:text-sm', s.subject.id === sid ? 'border-ink bg-hi font-bold text-hi-ink' : 'border-ink bg-surface text-ink')}>
            <span className="max-sm:hidden"><Dot slot={s.subject.slot} /></span>
            <span className="max-w-full truncate">{s.subject.short}</span>
            <span className="tnum text-[11px] opacity-70">{Math.round(s.completion)}%</span>
          </button>
        ))}
      </div>

      {ss && (
        <Card pad={false}>
          <div className="flex flex-wrap items-end gap-3 p-5">
            <div className="min-w-48 flex-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">{ss.subject.name}</span>
                <span className="tnum font-semibold">{ss.completion.toFixed(1)}%</span>
              </div>
              <Progress value={ss.completion} color={`var(--s${ss.subject.slot})`} className="mt-2" />
              <p className="mt-1.5 text-[13px] text-ink-3">
                {ss.completed} completed · {ss.inProgress} in progress · {ss.notStarted} not started · {ss.subject.faculty}
              </p>
            </div>
            <Field label="Search" className="w-full sm:w-52">
              <input className="inp" placeholder="Chapter name" value={q} onChange={(e) => setQ(e.target.value)} />
            </Field>
            <Field label="Status" className="w-full sm:w-48">
              <select className="inp" value={fst} onChange={(e) => setFst(e.target.value)}>
                <option value="">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="overflow-x-auto border-t border-line">
            {rows.length === 0 ? (
              <div className="p-5">
                <Empty title={filtered ? 'No chapters match' : 'No chapters yet'}>{filtered ? 'Clear the search or status filter.' : 'Add the chapters for this subject.'}</Empty>
              </div>
            ) : (
              <>
              <ul className="divide-y divide-line md:hidden">
                {rows.map((c) => {
                  const ch = c.chapter
                  return (
                    <li key={ch.id} className="space-y-3 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium">
                            <span className="tnum text-ink-3">{ch.order + 1}. </span>
                            {ch.name}
                          </div>
                          {ch.totalLectures === 0 && <div className="text-xs text-warn">Set the lecture count to track this chapter</div>}
                        </div>
                        <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={c.progress} color={`var(--s${ss.subject.slot})`} className="h-1.5!" />
                        <span className="tnum text-xs text-ink-2">{Math.round(c.progress)}%</span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
                        <div className="inline-flex items-center gap-2">
                          <span className="text-ink-3">Lectures</span>
                          <Button size="sm" aria-label={`Remove a lecture from ${ch.name}`} disabled={c.lecturesDone <= 0} onClick={() => put('chapters', markLecture(ch, -1))}>
                            −
                          </Button>
                          <span className="tnum">
                            {c.lecturesDone}/{ch.totalLectures}
                          </span>
                          <Button size="sm" aria-label={`Mark a lecture done for ${ch.name}`} disabled={ch.totalLectures > 0 && c.lecturesDone >= ch.totalLectures} onClick={() => put('chapters', markLecture(ch, 1))}>
                            +
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        <span className="ml-auto">
                          <Button size="sm" variant="ghost" onClick={() => setEdit({ ch, isNew: false })}>
                            Edit
                          </Button>
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
              <table className="tbl hidden min-w-[980px] md:table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Chapter</th>
                    <th>Lectures</th>
                    <th>Status</th>
                    <th>Progress</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => {
                    const ch = c.chapter
                    return (
                      <tr key={ch.id}>
                        <td className="tnum text-ink-3">{ch.order + 1}</td>
                        <td className="max-w-[280px]">
                          <div className="font-medium">{ch.name}</div>
                          {ch.totalLectures === 0 && <div className="text-xs text-warn">Set the lecture count to track this chapter</div>}
                        </td>
                        <td className="whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <Button size="sm" aria-label={`Remove a lecture from ${ch.name}`} disabled={c.lecturesDone <= 0} onClick={() => put('chapters', markLecture(ch, -1))}>
                              −
                            </Button>
                            <span className="tnum min-w-12 text-center">
                              {c.lecturesDone}/{ch.totalLectures}
                            </span>
                            <Button size="sm" aria-label={`Mark a lecture done for ${ch.name}`} disabled={ch.totalLectures > 0 && c.lecturesDone >= ch.totalLectures} onClick={() => put('chapters', markLecture(ch, 1))}>
                              +
                            </Button>
                          </div>
                          <div className="tnum mt-1 text-xs text-ink-3">{Math.round(c.lecturePct)}% watched</div>
                        </td>
                        <td>
                          <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                        </td>
                        <td className="min-w-28">
                          <div className="tnum mb-1 text-xs text-ink-2">{Math.round(c.progress)}%</div>
                          <Progress value={c.progress} color={`var(--s${ss.subject.slot})`} className="h-1.5!" />
                        </td>
                        <td className="whitespace-nowrap text-right">
                          <Button size="sm" variant="ghost" aria-label={`Move ${ch.name} up`} disabled={filtered} onClick={() => move(c, -1)}>
                            ↑
                          </Button>
                          <Button size="sm" variant="ghost" aria-label={`Move ${ch.name} down`} disabled={filtered} onClick={() => move(c, 1)}>
                            ↓
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEdit({ ch, isNew: false })}>
                            Edit
                          </Button>
                          <ConfirmButton onConfirm={() => del('chapters', ch.id)} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </>
            )}
          </div>
        </Card>
      )}
      {edit && <ChapterForm ch={edit.ch} isNew={edit.isNew} onClose={() => setEdit(null)} />}
    </>
  )
}
