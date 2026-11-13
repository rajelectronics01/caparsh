import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSubjects } from '../components/SessionForm'
import { Badge, Button, Card, ConfirmButton, Dot, Empty, Field, Modal, num, PageHeader, Progress, statusTone, useToast, cx } from '../components/ui'
import { markLecture, setRevision } from '../lib/actions'
import type { ChapterStats, ChapterStatus } from '../lib/analytics'
import { newChapter } from '../lib/seed'
import { useStore } from '../lib/store'
import type { Chapter } from '../lib/types'

const STATUSES: ChapterStatus[] = ['Not Started', 'In Progress', 'Lectures Completed', 'Practice Pending', 'Revision Pending', 'Completed']

function ChapterForm({ ch, isNew, onClose }: { ch: Chapter; isNew: boolean; onClose: () => void }) {
  const { put } = useStore()
  const toast = useToast()
  const [f, setF] = useState({ name: ch.name, total: String(ch.totalLectures || ''), target: String(ch.questionTarget || ''), manual: String(ch.questionsManual || '') })
  const [err, setErr] = useState('')
  const save = () => {
    if (!f.name.trim()) return setErr('Chapter name is required.')
    if (num(f.total) < 0 || num(f.target) < 0 || num(f.manual) < 0) return setErr('Counts cannot be negative.')
    put('chapters', { ...ch, name: f.name.trim(), totalLectures: Math.round(num(f.total)), questionTarget: Math.round(num(f.target)), questionsManual: Math.round(num(f.manual)) })
    toast(isNew ? 'Chapter added' : 'Chapter updated')
    onClose()
  }
  return (
    <Modal title={isNew ? 'Add chapter' : 'Edit chapter'} onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Chapter name" className="sm:col-span-2">
          <input className="inp" autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Total lectures" hint="As per your faculty's batch.">
          <input type="number" min="0" className="inp" value={f.total} onChange={(e) => setF({ ...f, total: e.target.value })} />
        </Field>
        <Field label="Question-practice target">
          <input type="number" min="0" className="inp" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} />
        </Field>
        <Field label="Questions practised outside the log" hint="Added to questions from logged sessions and tests." className="sm:col-span-2">
          <input type="number" min="0" className="inp" value={f.manual} onChange={(e) => setF({ ...f, manual: e.target.value })} />
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
  const { sum, put, putMany, del, data } = useStore()
  const { subjects } = useSubjects()
  const [params, setParams] = useSearchParams()
  const sid = params.get('s') && subjects.some((s) => s.id === params.get('s')) ? params.get('s')! : (subjects[0]?.id ?? '')
  const [q, setQ] = useState('')
  const [fst, setFst] = useState('')
  const [edit, setEdit] = useState<{ ch: Chapter; isNew: boolean } | null>(null)
  const ss = sum.ss.find((s) => s.subject.id === sid)
  const rows = useMemo(() => (ss?.chapters ?? []).filter((c) => (!fst || c.status === fst) && c.chapter.name.toLowerCase().includes(q.trim().toLowerCase())), [ss, q, fst])
  const req = data.settings.requiredRevisions

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
      <PageHeader title="Syllabus Tracker" sub={`A chapter is Completed only when lectures, practice and ${req} revision${req > 1 ? 's' : ''} are all done.`}>
        <Button variant="primary" onClick={() => setEdit({ ch: newChapter(sid, '', ss?.chapters.length ?? 0), isNew: true })}>
          + Add chapter
        </Button>
      </PageHeader>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {sum.ss.map((s) => (
          <button key={s.subject.id} onClick={() => setParams({ s: s.subject.id })} className={cx('inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm', s.subject.id === sid ? 'border-accent bg-accent-soft font-medium text-accent' : 'border-line bg-surface text-ink-2')}>
            <Dot slot={s.subject.slot} />
            {s.subject.short}
            <span className="tnum text-xs opacity-70">{Math.round(s.completion)}%</span>
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
                        <span className="tnum text-ink-2">
                          Questions {c.questions}/{ch.questionTarget || '–'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        {[0, 1, 2].map((i) => (
                          <label key={i} className="inline-flex min-h-9 items-center gap-1.5">
                            <input type="checkbox" className="size-4 accent-(--accent)" checked={ch.revisions[i].done} onChange={(e) => put('chapters', setRevision(ch, i, { done: e.target.checked }))} />R{i + 1}
                          </label>
                        ))}
                        <label className="inline-flex min-h-9 items-center gap-1.5">
                          <input type="checkbox" className="size-4 accent-(--accent)" checked={ch.rtpDone} onChange={(e) => put('chapters', { ...ch, rtpDone: e.target.checked })} />
                          RTP/MTP/PYQ
                        </label>
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
                    <th>Questions practised</th>
                    <th>RTP/MTP/PYQ</th>
                    <th>Revisions</th>
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
                        <td className="tnum whitespace-nowrap">
                          {c.questions}
                          <span className="text-ink-3"> / {ch.questionTarget || 'no target'}</span>
                          {c.graded > 0 && <div className="text-xs text-ink-3">{Math.round((100 * c.correct) / c.graded)}% correct of {c.graded} checked</div>}
                        </td>
                        <td>
                          <input type="checkbox" aria-label={`RTP/MTP/PYQ done for ${ch.name}`} className="size-4 accent-(--accent)" checked={ch.rtpDone} onChange={(e) => put('chapters', { ...ch, rtpDone: e.target.checked })} />
                        </td>
                        <td className="whitespace-nowrap">
                          {[0, 1, 2].map((i) => (
                            <label key={i} className="mr-2.5 inline-flex items-center gap-1 text-[13px]">
                              <input type="checkbox" aria-label={`Revision ${i + 1} done for ${ch.name}`} className="size-4 accent-(--accent)" checked={ch.revisions[i].done} onChange={(e) => put('chapters', setRevision(ch, i, { done: e.target.checked }))} />R{i + 1}
                            </label>
                          ))}
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
