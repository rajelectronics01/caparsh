import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, Dot, Field, Modal, num, PageHeader, Progress, useToast } from '../components/ui'
import { fmtDate, fmtHM } from '../lib/dates'
import { useStore } from '../lib/store'
import type { Subject } from '../lib/types'

function SubjectForm({ s, onClose }: { s: Subject; onClose: () => void }) {
  const { put, data, setSettings } = useStore()
  const toast = useToast()
  const [f, setF] = useState({ after: s.startsAfter ?? '', name: s.name, short: s.short, faculty: s.faculty, avg: String(s.avgLectureMin), target: s.lectureTargetDate ?? '', weekly: String(data.settings.weeklyTargets[s.id] ?? '') })
  const [err, setErr] = useState('')
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }))
  const save = () => {
    if (!f.name.trim() || !f.short.trim()) return setErr('Name and short name are required.')
    if (!(num(f.avg) > 0)) return setErr('Average lecture length must be more than zero minutes.')
    put('subjects', { ...s, name: f.name.trim(), short: f.short.trim(), faculty: f.faculty.trim() || 'To be decided', startsAfter: f.after || undefined, avgLectureMin: num(f.avg), lectureTargetDate: f.target || undefined })
    setSettings({ weeklyTargets: { ...data.settings.weeklyTargets, [s.id]: Math.max(0, num(f.weekly)) } })
    toast('Subject updated')
    onClose()
  }
  return (
    <Modal title={`Edit ${s.short}`} onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Subject name" className="sm:col-span-2">
          <input className="inp" value={f.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Short name">
          <input className="inp" value={f.short} onChange={(e) => set({ short: e.target.value })} />
        </Field>
        <Field label="Faculty">
          <input className="inp" value={f.faculty} onChange={(e) => set({ faculty: e.target.value })} />
        </Field>
        <Field label="Average lecture length (min)" hint="Used for time estimates until real lecture sessions are logged.">
          <input type="number" min="1" className="inp" value={f.avg} onChange={(e) => set({ avg: e.target.value })} />
        </Field>
        <Field label="Weekly target (hours)">
          <input type="number" min="0" step="0.5" className="inp" value={f.weekly} onChange={(e) => set({ weekly: e.target.value })} />
        </Field>
        <Field label="Starts after" hint="Leave empty to start any time. GST starts after Direct Tax: it gets no pace target and no suggestions until that one's lectures are all watched." className="sm:col-span-2">
          <select className="inp" value={f.after} onChange={(e) => set({ after: e.target.value })}>
            <option value="">No, start any time</option>
            {data.subjects
              .filter((x) => x.id !== s.id)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Finish lectures by" hint="Sets the pace. Falling behind it shows up as lecture backlog." className="sm:col-span-2">
          <input type="date" className="inp" value={f.target} onChange={(e) => set({ target: e.target.value })} />
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

export default function Subjects() {
  const { sum, data } = useStore()
  const [edit, setEdit] = useState<Subject | null>(null)
  return (
    <>
      <PageHeader title="Subjects" sub="Six papers in two groups. Taxation and FM-SM are tracked as two parts each." />
      {[1, 2].map((g) => (
        <div key={g} className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-2">Group {g}</h2>
            <span className="tnum text-sm text-ink-3">{(g === 1 ? sum.comp.g1 : sum.comp.g2).toFixed(1)}% complete</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sum.ss
              .filter((s) => s.subject.group === g)
              .map((s) => (
                <Card key={s.subject.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Dot slot={s.subject.slot} />
                        <h3 className="truncate font-semibold">{s.subject.name}</h3>
                      </div>
                      <p className="mt-0.5 text-[13px] text-ink-3">
                        Paper {s.subject.paper}
                        {s.subject.paperName !== s.subject.name ? ` · ${s.subject.paperName}` : ''} · {s.subject.faculty}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => setEdit(s.subject)}>
                      Edit
                    </Button>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-ink-2">Syllabus</span>
                    <span className="tnum font-semibold">{s.completion.toFixed(1)}%</span>
                  </div>
                  <Progress value={s.completion} color={`var(--s${s.subject.slot})`} className="mt-1.5" />
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                    <dt className="text-ink-3">Chapters complete</dt>
                    <dd className="tnum text-right">
                      {s.completed} / {s.chapters.length}
                    </dd>
                    <dt className="text-ink-3">Lectures</dt>
                    <dd className="tnum text-right">{s.totalLectures ? `${s.lecturesDone} / ${s.totalLectures}` : 'Counts not set'}</dd>
                    <dt className="text-ink-3">Time studied</dt>
                    <dd className="tnum text-right">{fmtHM(s.minutes)}</dd>
                    <dt className="text-ink-3">Weekly target</dt>
                    <dd className="tnum text-right">{data.settings.weeklyTargets[s.subject.id] ? `${data.settings.weeklyTargets[s.subject.id]}h` : 'Not set'}</dd>
                    <dt className="text-ink-3">Finish lectures by</dt>
                    <dd className="tnum text-right">{s.subject.lectureTargetDate ? fmtDate(s.subject.lectureTargetDate) : 'Not set'}</dd>
                  </dl>
                  <div className="mt-4 flex items-center justify-between">
                    {s.locked ? <Badge tone="accent">Starts after {s.startsAfterName}</Badge> : s.behind > 0 ? <Badge tone="warn">{s.behind} lectures behind pace</Badge> : <span />}
                    <Link to={`/syllabus?s=${s.subject.id}`} className="text-sm font-bold text-accent underline">
                      Chapters →
                    </Link>
                  </div>
                </Card>
              ))}
          </div>
        </div>
      ))}
      {edit && <SubjectForm s={edit} onClose={() => setEdit(null)} />}
    </>
  )
}
