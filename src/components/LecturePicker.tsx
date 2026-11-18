import { useState } from 'react'
import { fmtHM } from '../lib/dates'
import { unitOf, type OrderedLecture } from '../lib/lectureLists'
import { Button, cx } from './ui'

export const lectureKey = (o: OrderedLecture) => `${o.chapter.id}|${o.lecture.id}`
/** Minutes of a lecture still to watch (a partly watched one counts in part). 0 when its length is not listed. */
export const remainingMinutes = (o: OrderedLecture) => (o.lecture.minutes > 0 ? o.lecture.minutes * (1 - Math.min(99, o.lecture.pct ?? 0) / 100) : 0)

/** Tick the lectures you just watched, from the ones still to watch, in the order the faculty teaches them. */
export function LecturePicker({ remaining, picked, onToggle, onToggleMany }: { remaining: OrderedLecture[]; picked: Set<string>; onToggle: (o: OrderedLecture) => void; onToggleMany: (items: OrderedLecture[], on: boolean) => void }) {
  const [count, setCount] = useState(8)
  if (!remaining.length) return <p className="border-2 border-ink bg-[var(--p4)] p-3 text-sm font-bold text-[var(--on-color)]">Every lecture in your list is watched, so this session is logged as time only.</p>
  const shown = remaining.slice(0, count)
  return (
    <div>
      <ul className="max-h-72 divide-y-2 divide-ink overflow-y-auto border-2 border-ink bg-surface">
        {shown.map((o, i) => {
          const on = picked.has(lectureKey(o))
          const unit = unitOf(o.chapter.subjectId, o.lecture.title)
          const isFirstOfUnit = i === 0 || unitOf(shown[i - 1].chapter.subjectId, shown[i - 1].lecture.title).key !== unit.key
          // All the parts of this lecture that are still to watch, wherever they are in the list.
          const parts = isFirstOfUnit ? remaining.filter((r) => unitOf(r.chapter.subjectId, r.lecture.title).key === unit.key) : []
          const allOn = parts.length > 0 && parts.every((r) => picked.has(lectureKey(r)))
          return (
            <li key={lectureKey(o)}>
              {isFirstOfUnit && parts.length > 1 && (
                <div className="flex items-center justify-between gap-2 border-b border-ink/40 bg-surface-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wide">
                  <span>
                    {unit.label} · {parts.length} parts · {fmtHM(parts.reduce((a, r) => a + remainingMinutes(r), 0))}
                  </span>
                  <button type="button" className="press border-2 border-ink bg-surface px-2 py-0.5 text-[11px] font-bold uppercase" onClick={() => onToggleMany(parts, !allOn)}>
                    {allOn ? 'Clear' : 'Select whole lecture'}
                  </button>
                </div>
              )}
              <label className={cx('flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2', on && 'bg-[var(--p1)] text-[var(--on-color)]')}>
                <input type="checkbox" checked={on} onChange={() => onToggle(o)} aria-label={`Watched: ${o.lecture.title}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">
                    <span className="tnum mr-2 text-xs font-normal opacity-70">{o.n}</span>
                    {o.lecture.title}
                    {o.lecture.pct ? <span className="ml-2 text-xs font-bold opacity-80">{o.lecture.pct}% already watched</span> : null}
                  </span>
                  <span className="block truncate text-xs opacity-75">{o.chapter.name}</span>
                </span>
                <span className="tnum shrink-0 text-xs">{o.lecture.minutes > 0 ? fmtHM(o.lecture.minutes) : '—'}</span>
              </label>
            </li>
          )
        })}
      </ul>
      {remaining.length > count && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setCount(count + 10)}>
            Show 10 more
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCount(remaining.length)}>
            Show all {remaining.length}
          </Button>
        </div>
      )}
    </div>
  )
}
