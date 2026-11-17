import { fmtHM } from '../lib/dates'
import { activityLabel, type Chapter, type Session, type Subject } from '../lib/types'

/** Someone's study log for a day: when, which subject, what kind, how long. Works for any person's data. */
export function SessionLines({ sessions, subjects, chapters, empty = 'Nothing logged', compact }: { sessions: Session[]; subjects: Subject[]; chapters?: Chapter[]; empty?: string; compact?: boolean }) {
  if (!sessions.length) return <p className="text-sm text-ink-3">{empty}</p>
  return (
    <ul className={compact ? 'flex flex-wrap gap-2' : 'divide-y-2 divide-ink border-2 border-ink'}>
      {sessions.map((s) => {
        const sub = subjects.find((x) => x.id === s.subjectId)
        const chapter = chapters?.find((c) => c.id === s.chapterId)?.name
        const when = s.start ? `${s.start}–${s.end}` : 'no time'
        if (compact)
          return (
            <li key={s.id} className="inline-flex items-stretch border-2 border-ink bg-surface text-ink" title={chapter}>
              <span className="w-2" style={{ background: `var(--s${sub?.slot ?? 1})` }} />
              <span className="px-2 py-1 text-xs">
                <span className="font-bold uppercase">{sub?.short ?? '?'}</span> <span className="tnum">{fmtHM(s.durationMin)}</span> <span className="tnum text-ink-3">{when}</span>
              </span>
            </li>
          )
        return (
          <li key={s.id} className="flex items-stretch bg-surface text-ink">
            <span className="w-3 shrink-0" style={{ background: `var(--s${sub?.slot ?? 1})` }} />
            <div className="min-w-0 flex-1 px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-bold uppercase">{sub?.short ?? 'Subject'}</span>
                <span className="tnum shrink-0 text-base font-bold">{fmtHM(s.durationMin)}</span>
              </div>
              <div className="tnum text-xs text-ink-2">
                {when} · {activityLabel(s.activity)}
                {s.lecturesCompleted ? ` · ${s.lecturesCompleted} lec` : ''}
              </div>
              {(chapter || s.topic) && <div className="truncate text-xs text-ink-3">{[chapter, s.topic].filter(Boolean).join(' · ')}</div>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
