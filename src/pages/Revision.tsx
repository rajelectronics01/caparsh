import { useMemo, useState } from 'react'
import { useSubjects } from '../components/SessionForm'
import { Badge, Button, Card, Check, Dot, Empty, Field, Modal, num, PageHeader, Seg, Stat, useToast } from '../components/ui'
import { setRevision } from '../lib/actions'
import type { ChapterStats } from '../lib/analytics'
import { fmtDate, fmtHM, today, uid } from '../lib/dates'
import { useStore } from '../lib/store'

type Bucket = 'all' | 'never' | 'due' | '1' | '2' | '3'

function RevisionForm({ c, cycle, onClose }: { c: ChapterStats; cycle: number; onClose: () => void }) {
  const { put } = useStore()
  const toast = useToast()
  const r = c.chapter.revisions[cycle]
  const [f, setF] = useState({
    date: r.date ?? today(),
    min: r.durationMin ? String(r.durationMin) : '',
    done: r.done || !r.date,
    confidence: r.confidence ?? 3,
    weak: r.weakAreas ?? '',
    again: r.topicsAgain ?? '',
    next: c.chapter.nextRevisionDate ?? '',
    log: !r.done,
  })
  const [err, setErr] = useState('')
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }))
  const save = () => {
    if (!f.date) return setErr('Pick the revision date.')
    if (num(f.min) < 0) return setErr('Duration cannot be negative.')
    const ch = setRevision(c.chapter, cycle, { done: f.done, date: f.date, durationMin: Math.round(num(f.min)) || undefined, confidence: f.confidence, weakAreas: f.weak.trim() || undefined, topicsAgain: f.again.trim() || undefined })
    put('chapters', { ...ch, nextRevisionDate: f.next || undefined })
    if (f.log && f.done && num(f.min) > 0)
      put('sessions', { id: uid(), date: f.date, subjectId: c.chapter.subjectId, chapterId: c.chapter.id, activity: 'revision', durationMin: Math.round(num(f.min)), topic: `Revision ${cycle + 1}`, status: 'completed' })
    toast(`Revision ${cycle + 1} saved`)
    onClose()
  }
  return (
    <Modal title={`Revision ${cycle + 1} · ${c.chapter.name}`} onClose={onClose} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Revision date">
          <input type="date" className="inp" value={f.date} onChange={(e) => set({ date: e.target.value })} />
        </Field>
        <Field label="Duration (minutes)">
          <input type="number" min="0" className="inp" value={f.min} onChange={(e) => set({ min: e.target.value })} />
        </Field>
        <Field label="Status">
          <select className="inp" value={f.done ? 'done' : 'pending'} onChange={(e) => set({ done: e.target.value === 'done' })}>
            <option value="done">Completed</option>
            <option value="pending">Not completed</option>
          </select>
        </Field>
        <Field label={`Confidence: ${f.confidence} / 5`}>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Button key={n} variant={f.confidence === n ? 'primary' : 'soft'} className="flex-1" aria-pressed={f.confidence === n} onClick={() => set({ confidence: n })}>
                {n}
              </Button>
            ))}
          </div>
        </Field>
        <Field label="Weak areas" className="sm:col-span-2">
          <textarea className="inp" value={f.weak} onChange={(e) => set({ weak: e.target.value })} />
        </Field>
        <Field label="Topics that need another revision" className="sm:col-span-2">
          <textarea className="inp" value={f.again} onChange={(e) => set({ again: e.target.value })} />
        </Field>
        <Field label="Next revision date" hint="Shows under “Due” once this date arrives.">
          <input type="date" className="inp" value={f.next} onChange={(e) => set({ next: e.target.value })} />
        </Field>
        {!r.done && (
          <div className="flex items-end">
            <Check label="Also add this time to the study log" checked={f.log} onChange={(v) => set({ log: v })} />
          </div>
        )}
      </div>
      {err && (
        <p role="alert" className="mt-4 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
          {err}
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save}>
          Save revision
        </Button>
      </div>
    </Modal>
  )
}

export default function Revision() {
  const { sum, put } = useStore()
  const { subjects, subject } = useSubjects()
  const t = today()
  const [bucket, setBucket] = useState<Bucket>('all')
  const [fs, setFs] = useState('')
  const [q, setQ] = useState('')
  const [form, setForm] = useState<{ c: ChapterStats; cycle: number } | null>(null)
  const isDue = (c: ChapterStats) => !!c.chapter.nextRevisionDate && c.chapter.nextRevisionDate <= t && c.revisionsDone < 3
  const counts = {
    never: sum.cs.filter((c) => c.revisionsDone === 0).length,
    due: sum.cs.filter(isDue).length,
    '1': sum.cs.filter((c) => c.revisionsDone === 1).length,
    '2': sum.cs.filter((c) => c.revisionsDone === 2).length,
    '3': sum.cs.filter((c) => c.revisionsDone === 3).length,
  }
  const rows = useMemo(
    () =>
      sum.cs
        .filter((c) => (!fs || c.chapter.subjectId === fs) && c.chapter.name.toLowerCase().includes(q.trim().toLowerCase()))
        .filter((c) => (bucket === 'all' ? true : bucket === 'never' ? c.revisionsDone === 0 : bucket === 'due' ? isDue(c) : c.revisionsDone === Number(bucket)))
        .sort((a, b) => Number(isDue(b)) - Number(isDue(a)) || (a.chapter.nextRevisionDate ?? '9').localeCompare(b.chapter.nextRevisionDate ?? '9')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sum.cs, fs, q, bucket, t],
  )

  return (
    <>
      <PageHeader title="Revision Manager" sub="Three revision cycles per chapter, with confidence and weak areas." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Never revised" value={counts.never} />
        <Stat label="Due for revision" value={counts.due} tone={counts.due ? 'warn' : undefined} />
        <Stat label="Revised once" value={counts['1']} />
        <Stat label="Revised twice" value={counts['2']} />
        <Stat label="Revised three times" value={counts['3']} tone={counts['3'] ? 'good' : undefined} />
      </div>
      <Card className="mt-4" pad={false}>
        <div className="flex flex-wrap items-end gap-3 p-5">
          <div className="overflow-x-auto">
            <Seg value={bucket} onChange={setBucket} options={[{ id: 'all', label: 'All' }, { id: 'due', label: 'Due' }, { id: 'never', label: 'Never' }, { id: '1', label: 'Once' }, { id: '2', label: 'Twice' }, { id: '3', label: 'Thrice' }]} />
          </div>
          <Field label="Subject" className="w-full sm:w-44">
            <select className="inp" value={fs} onChange={(e) => setFs(e.target.value)}>
              <option value="">All subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.short}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Search" className="w-full sm:w-52">
            <input className="inp" placeholder="Chapter name" value={q} onChange={(e) => setQ(e.target.value)} />
          </Field>
        </div>
        <div className="overflow-x-auto border-t border-line">
          {rows.length === 0 ? (
            <div className="p-5">
              <Empty title="No chapters in this view" />
            </div>
          ) : (
            <>
            <ul className="divide-y divide-line md:hidden">
              {rows.map((c) => (
                <li key={c.chapter.id} className="space-y-2 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-bold">{c.chapter.name}</div>
                      <div className="text-xs text-ink-3">
                        {subject(c.chapter.subjectId)?.short} · lectures {Math.round(c.lecturePct)}%{c.chapter.nextRevisionDate ? ` · next ${fmtDate(c.chapter.nextRevisionDate)}` : ''}
                      </div>
                    </div>
                    {isDue(c) && <Badge tone="warn">Due</Badge>}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[0, 1, 2].map((i) => {
                      const r = c.chapter.revisions[i]
                      return (
                        <Button key={i} variant={r.done ? 'primary' : 'soft'} disabled={!r.done && i > 0 && !c.chapter.revisions[i - 1].done} onClick={() => setForm({ c, cycle: i })}>
                          R{i + 1} {r.done ? '✓' : ''}
                        </Button>
                      )
                    })}
                  </div>
                </li>
              ))}
            </ul>
            <table className="tbl hidden min-w-[900px] md:table">
              <thead>
                <tr>
                  <th>Chapter</th>
                  <th>Revision 1</th>
                  <th>Revision 2</th>
                  <th>Revision 3</th>
                  <th>Weak areas / revise again</th>
                  <th>Next revision</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.chapter.id}>
                    <td className="max-w-[260px]">
                      <span className="inline-flex items-center gap-2">
                        <Dot slot={subject(c.chapter.subjectId)?.slot ?? 1} />
                        <span className="font-medium">{c.chapter.name}</span>
                      </span>
                      <div className="mt-0.5 text-xs text-ink-3">
                        {subject(c.chapter.subjectId)?.short} · lectures {Math.round(c.lecturePct)}%
                      </div>
                    </td>
                    {[0, 1, 2].map((i) => {
                      const r = c.chapter.revisions[i]
                      return (
                        <td key={i} className="whitespace-nowrap">
                          {r.done ? (
                            <button className="text-left" onClick={() => setForm({ c, cycle: i })}>
                              <Badge tone="good">Done {r.date ? fmtDate(r.date) : ''}</Badge>
                              <div className="tnum mt-1 text-xs text-ink-3">
                                {r.durationMin ? `${fmtHM(r.durationMin)} · ` : ''}confidence {r.confidence ?? '–'}/5
                              </div>
                            </button>
                          ) : (
                            <Button size="sm" disabled={i > 0 && !c.chapter.revisions[i - 1].done} onClick={() => setForm({ c, cycle: i })}>
                              Record
                            </Button>
                          )}
                        </td>
                      )
                    })}
                    <td className="max-w-[240px] text-[13px] text-ink-2">
                      {c.chapter.revisions
                        .flatMap((r) => [r.weakAreas, r.topicsAgain])
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </td>
                    <td className="whitespace-nowrap">
                      <input type="date" aria-label={`Next revision date for ${c.chapter.name}`} className="inp w-auto! min-h-8! py-1!" value={c.chapter.nextRevisionDate ?? ''} onChange={(e) => put('chapters', { ...c.chapter, nextRevisionDate: e.target.value || undefined })} />
                      {isDue(c) && (
                        <div className="mt-1">
                          <Badge tone="warn">Due</Badge>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </>
          )}
        </div>
      </Card>
      {form && <RevisionForm c={form.c} cycle={form.cycle} onClose={() => setForm(null)} />}
    </>
  )
}
