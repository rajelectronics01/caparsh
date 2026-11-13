import { useMemo, useState } from 'react'
import { HBars, Lines } from '../components/charts'
import { useSubjects } from '../components/SessionForm'
import { Badge, Button, Card, ConfirmButton, Dot, Empty, Field, Modal, num, PageHeader, pct, Stat, useToast } from '../components/ui'
import { accuracyBySubject, chapterStrength } from '../lib/analytics'
import { fmtDate, fmtHM, fmtShort, today } from '../lib/dates'
import { useStore } from '../lib/store'
import { TEST_TYPES, type TestRecord, type TestType } from '../lib/types'

function TestForm({ initial, onClose }: { initial: Partial<TestRecord>; onClose: () => void }) {
  const { put } = useStore()
  const { subjects, chaptersOf } = useSubjects()
  const toast = useToast()
  const s = (v: number | undefined) => (v != null ? String(v) : '')
  const [f, setF] = useState({
    date: initial.date ?? today(),
    subjectId: initial.subjectId ?? subjects[0]?.id ?? '',
    chapterId: initial.chapterId ?? '',
    type: (initial.type ?? 'Chapter Test') as TestType,
    totalMarks: s(initial.totalMarks),
    marks: s(initial.marks),
    attempted: s(initial.attempted),
    correct: s(initial.correct),
    incorrect: s(initial.incorrect),
    timeMin: s(initial.timeMin),
    remarks: initial.remarks ?? '',
  })
  const [err, setErr] = useState('')
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }))
  const att = Math.round(num(f.attempted))
  const cor = Math.round(num(f.correct))
  const inc = f.incorrect === '' ? Math.max(0, att - cor) : Math.round(num(f.incorrect))
  const save = () => {
    const total = num(f.totalMarks)
    const marks = num(f.marks)
    if (!f.date || !f.subjectId) return setErr('Date and subject are required.')
    if ([total, marks, att, cor, inc, num(f.timeMin)].some((n) => n < 0)) return setErr('Values cannot be negative.')
    if (total <= 0 && att <= 0) return setErr('Enter total marks, or the number of questions attempted.')
    if (marks > total) return setErr('Marks obtained cannot exceed total marks.')
    if (cor + inc > att) return setErr('Correct plus incorrect cannot exceed questions attempted.')
    put('tests', { id: initial.id ?? crypto.randomUUID(), date: f.date, subjectId: f.subjectId, chapterId: f.chapterId || undefined, type: f.type, totalMarks: total, marks, attempted: att, correct: cor, incorrect: inc, timeMin: Math.round(num(f.timeMin)), remarks: f.remarks.trim() || undefined })
    toast(initial.id ? 'Test updated' : 'Test recorded')
    onClose()
  }
  const n = (label: string, k: 'totalMarks' | 'marks' | 'attempted' | 'correct' | 'incorrect' | 'timeMin', hint?: string, ph?: string) => (
    <Field label={label} hint={hint}>
      <input type="number" min="0" step={k === 'marks' || k === 'totalMarks' ? '0.5' : '1'} inputMode="decimal" className="inp" placeholder={ph} value={f[k]} onChange={(e) => set({ [k]: e.target.value })} />
    </Field>
  )
  return (
    <Modal title={initial.id ? 'Edit test' : 'Record a test'} onClose={onClose} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date">
          <input type="date" className="inp" value={f.date} onChange={(e) => set({ date: e.target.value })} />
        </Field>
        <Field label="Test type">
          <select className="inp" value={f.type} onChange={(e) => set({ type: e.target.value as TestType })}>
            {TEST_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Subject">
          <select className="inp" value={f.subjectId} onChange={(e) => set({ subjectId: e.target.value, chapterId: '' })}>
            {subjects.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Chapter">
          <select className="inp" value={f.chapterId} onChange={(e) => set({ chapterId: e.target.value })}>
            <option value="">Whole subject / multiple chapters</option>
            {chaptersOf(f.subjectId).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        {n('Total marks', 'totalMarks')}
        {n('Marks obtained', 'marks')}
        {n('Questions attempted', 'attempted')}
        {n('Correct answers', 'correct')}
        {n('Incorrect answers', 'incorrect', 'Left empty: attempted minus correct.', String(Math.max(0, att - cor)))}
        {n('Time taken (minutes)', 'timeMin')}
        <Field label="Remarks" className="sm:col-span-2">
          <textarea className="inp" value={f.remarks} onChange={(e) => set({ remarks: e.target.value })} />
        </Field>
      </div>
      <p className="mt-3 text-[13px] text-ink-3">
        Accuracy: <span className="tnum font-medium text-ink">{att > 0 ? pct((100 * cor) / att) : '—'}</span> (correct ÷ attempted). Test time is not added to study hours; log a mock-test session for that.
      </p>
      {err && (
        <p role="alert" className="mt-3 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
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

export default function Tests() {
  const { data, sum, del } = useStore()
  const { subjects, subject, chapter } = useSubjects()
  const [form, setForm] = useState<Partial<TestRecord> | null>(null)
  const [fs, setFs] = useState('')
  const [ft, setFt] = useState('')
  const [q, setQ] = useState('')
  const rows = useMemo(
    () =>
      data.tests
        .filter((t) => (!fs || t.subjectId === fs) && (!ft || t.type === ft))
        .filter((t) => `${data.chapters.find((c) => c.id === t.chapterId)?.name ?? ''} ${t.remarks ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [data.tests, data.chapters, fs, ft, q],
  )
  const scored = data.tests.filter((t) => t.totalMarks > 0)
  const trend = [...scored].filter((t) => !fs || t.subjectId === fs).sort((a, b) => a.date.localeCompare(b.date)).map((t, i) => ({ i: String(i + 1), date: t.date, score: Math.round((1000 * t.marks) / t.totalMarks) / 10 }))
  const acc = accuracyBySubject(data)
  const strength = chapterStrength(sum.cs)
  const weak = strength.filter((c) => c.strength === 'weak')
  const mid = strength.filter((c) => c.strength === 'needs practice')
  const strong = strength.filter((c) => c.strength === 'strong').reverse()
  const avg = scored.length ? scored.reduce((a, t) => a + (100 * t.marks) / t.totalMarks, 0) / scored.length : null
  const list = (items: typeof strength, empty: string) =>
    items.length === 0 ? (
      <p className="text-sm text-ink-3">{empty}</p>
    ) : (
      <ul className="space-y-2 text-sm">
        {items.slice(0, 6).map((c) => (
          <li key={c.chapter.id} className="flex items-center justify-between gap-3">
            <span className="inline-flex min-w-0 items-center gap-2">
              <Dot slot={subject(c.chapter.subjectId)?.slot ?? 1} />
              <span className="truncate">{c.chapter.name}</span>
            </span>
            <span className="tnum shrink-0 text-ink-2">
              {pct(c.accuracy)} <span className="text-ink-3">({c.correct}/{c.graded})</span>
            </span>
          </li>
        ))}
      </ul>
    )

  return (
    <>
      <PageHeader title="Tests & Performance" sub="PYQ, RTP, MTP, mocks and chapter tests.">
        <Button variant="primary" onClick={() => setForm({})}>
          + Record test
        </Button>
      </PageHeader>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Tests taken" value={data.tests.length} />
        <Stat label="Average score" value={avg == null ? '—' : pct(avg)} hint="Marks obtained ÷ total marks" />
        <Stat label="Best score" value={scored.length ? pct(Math.max(...scored.map((t) => (100 * t.marks) / t.totalMarks))) : '—'} />
        <Stat label="Weak chapters" value={weak.length} tone={weak.length ? 'bad' : undefined} hint="Under 50% accuracy" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Test-score trend" sub={fs ? `${subject(fs)?.short} tests in date order` : 'All tests in date order (filter by subject below)'}>
          <Lines data={trend} xKey="i" series={[{ key: 'score', label: 'Score %', color: 'var(--s1)' }]} yMax={100} fmtX={(i) => `#${i}`} fmtLabel={(i) => `Test #${i} · ${fmtDate(trend[Number(i) - 1]?.date ?? today())}`} fmtValue={(v) => `${v}%`} empty={<Empty title="No scored tests yet">Record a test with total marks and marks obtained.</Empty>} />
        </Card>
        <Card title="Subject-wise accuracy" sub="Correct ÷ answers checked, from practice sessions and tests">
          <HBars max={100} fmt={pct} rows={acc.filter((a) => a.accuracy != null).map((a) => ({ key: a.subject.id, label: a.subject.short, value: a.accuracy!, color: `var(--s${a.subject.slot})`, note: `${a.correct}/${a.graded} correct` }))} empty={<Empty title="No accuracy data yet">Record correct answers in practice sessions or tests.</Empty>} />
        </Card>
        <Card title="Weak chapters" sub="Under 50% accuracy (at least 5 checked answers)">
          {list(weak, 'No weak chapters identified yet.')}
        </Card>
        <Card title="Need more practice" sub="50–70% accuracy">
          {list(mid, 'None in this band.')}
        </Card>
        <Card title="Strong chapters" sub="70% accuracy and above" className="lg:col-span-2">
          {list(strong, 'No strong chapters identified yet.')}
        </Card>
      </div>
      <Card className="mt-4" title="All tests" pad={false}>
        <div className="grid gap-3 px-5 pt-4 sm:grid-cols-3">
          <Field label="Search">
            <input className="inp" placeholder="Chapter or remarks" value={q} onChange={(e) => setQ(e.target.value)} />
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
          <Field label="Type">
            <select className="inp" value={ft} onChange={(e) => setFt(e.target.value)}>
              <option value="">All types</option>
              {TEST_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="overflow-x-auto p-5">
          {rows.length === 0 ? (
            <Empty title={data.tests.length ? 'No tests match these filters' : 'No tests recorded yet'} />
          ) : (
            <table className="tbl min-w-[860px]">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Subject</th>
                  <th>Chapter</th>
                  <th>Type</th>
                  <th className="text-right!">Marks</th>
                  <th className="text-right!">Attempted</th>
                  <th className="text-right!">Correct</th>
                  <th className="text-right!">Incorrect</th>
                  <th className="text-right!">Accuracy</th>
                  <th className="text-right!">Time</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} title={t.remarks}>
                    <td className="tnum whitespace-nowrap">{fmtShort(t.date)} {t.date.slice(0, 4)}</td>
                    <td className="whitespace-nowrap">
                      <span className="inline-flex items-center gap-2">
                        <Dot slot={subject(t.subjectId)?.slot ?? 1} />
                        {subject(t.subjectId)?.short}
                      </span>
                    </td>
                    <td className="max-w-[220px] truncate">{chapter(t.chapterId)?.name ?? '—'}</td>
                    <td>
                      <Badge>{t.type}</Badge>
                    </td>
                    <td className="tnum text-right">{t.totalMarks > 0 ? `${t.marks}/${t.totalMarks} (${pct((100 * t.marks) / t.totalMarks)})` : '—'}</td>
                    <td className="tnum text-right">{t.attempted || '—'}</td>
                    <td className="tnum text-right">{t.attempted ? t.correct : '—'}</td>
                    <td className="tnum text-right">{t.attempted ? t.incorrect : '—'}</td>
                    <td className="tnum text-right font-medium">{t.attempted ? pct((100 * t.correct) / t.attempted) : '—'}</td>
                    <td className="tnum text-right text-ink-2">{t.timeMin ? fmtHM(t.timeMin) : '—'}</td>
                    <td className="whitespace-nowrap text-right">
                      <Button size="sm" variant="ghost" onClick={() => setForm(t)}>
                        Edit
                      </Button>
                      <ConfirmButton onConfirm={() => del('tests', t.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
      {form && <TestForm initial={form} onClose={() => setForm(null)} />}
    </>
  )
}
