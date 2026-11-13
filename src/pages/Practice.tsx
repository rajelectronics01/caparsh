import { useMemo, useState } from 'react'
import { HBars } from '../components/charts'
import { SessionForm, useSubjects } from '../components/SessionForm'
import { Button, Card, Dot, Empty, Field, PageHeader, pct, Progress, Stat } from '../components/ui'
import { accuracyBySubject } from '../lib/analytics'
import { fmtHM } from '../lib/dates'
import { useStore } from '../lib/store'
import type { Activity, Session } from '../lib/types'
import { SessionTable } from './DailyLog'

const PRACTICE: Activity[] = ['practice', 'rtp', 'mock']

export default function Practice() {
  const { data, sum } = useStore()
  const { subjects } = useSubjects()
  const [form, setForm] = useState<Partial<Session> | null>(null)
  const [fs, setFs] = useState('')
  const [q, setQ] = useState('')
  const rows = useMemo(
    () =>
      data.sessions
        .filter((s) => PRACTICE.includes(s.activity) && (!fs || s.subjectId === fs))
        .filter((s) => `${data.chapters.find((c) => c.id === s.chapterId)?.name ?? ''} ${s.topic ?? ''} ${s.notes ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [data.sessions, data.chapters, fs, q],
  )
  const acc = accuracyBySubject(data)
  const attempted = acc.reduce((a, x) => a + x.attempted, 0)
  const graded = acc.reduce((a, x) => a + x.graded, 0)
  const correct = acc.reduce((a, x) => a + x.correct, 0)
  const short = sum.cs.filter((c) => c.chapter.questionTarget > 0 && c.questions < c.chapter.questionTarget && (c.lecturesDone > 0 || c.questions > 0)).sort((a, b) => a.questions / a.chapter.questionTarget - b.questions / b.chapter.questionTarget)

  return (
    <>
      <PageHeader title="Question Practice" sub="Attempted and answered-correctly are tracked separately, always.">
        <Button variant="primary" onClick={() => setForm({ activity: 'practice' })}>
          + Log practice
        </Button>
      </PageHeader>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Questions attempted" value={attempted} hint="Sessions and tests combined" />
        <Stat label="Answers checked" value={graded} hint="Attempts where you recorded a result" />
        <Stat label="Answered correctly" value={correct} />
        <Stat label="Accuracy" value={graded ? pct((100 * correct) / graded) : '—'} hint={graded ? 'Correct ÷ checked' : 'Record correct answers to see this'} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Attempted vs correct by subject" sub="Top bar attempted, bottom bar correct">
          <HBars fmt={(v) => `${v}`} rows={acc.map((a) => ({ key: a.subject.id, label: a.subject.short, value: a.attempted, color: `var(--s${a.subject.slot})`, value2: a.correct, color2: 'var(--ink-3)' }))} empty={<Empty title="No questions logged yet">Log a practice session with the number of questions attempted.</Empty>} />
        </Card>
        <Card title="Chapters short of their practice target">
          {short.length === 0 ? (
            <Empty title="Nothing short of target">Set a question-practice target for each chapter in the Syllabus Tracker.</Empty>
          ) : (
            <ul className="space-y-3">
              {short.slice(0, 8).map((c) => (
                <li key={c.chapter.id} className="text-sm">
                  <div className="mb-1 flex justify-between gap-3">
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <Dot slot={subjects.find((s) => s.id === c.chapter.subjectId)?.slot ?? 1} />
                      <span className="truncate">{c.chapter.name}</span>
                    </span>
                    <span className="tnum shrink-0 text-ink-2">
                      {c.questions}/{c.chapter.questionTarget}
                    </span>
                  </div>
                  <Progress value={(100 * c.questions) / c.chapter.questionTarget} className="h-1.5!" />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <Card className="mt-4" title="Practice sessions" pad={false}>
        <div className="grid gap-3 px-5 pt-4 sm:grid-cols-3">
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
          <div className="flex items-end text-sm text-ink-3">
            {rows.length} sessions · {fmtHM(rows.reduce((a, s) => a + s.durationMin, 0))}
          </div>
        </div>
        <div className="p-5">{rows.length ? <SessionTable rows={rows.slice(0, 200)} onEdit={setForm} showDate /> : <Empty title="No practice sessions yet" />}</div>
      </Card>
      {form && <SessionForm initial={form} onClose={() => setForm(null)} lockActivity={PRACTICE} />}
    </>
  )
}
