import { useMemo, useState } from 'react'
import { toggleLecture } from '../lib/actions'
import { fmtHM } from '../lib/dates'
import { watchOrder } from '../lib/lectureLists'
import type { Chapter } from '../lib/types'
import { Button, Seg, cx } from './ui'

/** A subject's lectures in the order the faculty teaches them, starting at lecture 1, with the next one up front. */
export function WatchOrder({ chapters, onChange }: { chapters: Chapter[]; onChange: (c: Chapter) => void }) {
  const [show, setShow] = useState<'next' | 'all'>('next')
  const rows = useMemo(() => watchOrder(chapters), [chapters])
  const next = rows.find((r) => !r.lecture.done)
  const nextTen = rows.filter((r) => !r.lecture.done).slice(0, 10)
  const shown = show === 'next' ? nextTen : rows
  const doneCount = rows.length - rows.filter((r) => !r.lecture.done).length

  if (!rows.length) return <p className="p-5 text-sm text-ink-3">No lectures are listed for this subject yet.</p>
  return (
    <div className="p-4">
      {next ? (
        <div className="mb-4 border-2 border-ink bg-[var(--p1)] p-3 text-[var(--on-color)]">
          <div className="text-[11px] font-bold uppercase tracking-widest">Watch next · lecture {next.n} of {rows.length}</div>
          <div className="mt-1 text-lg font-bold leading-tight">{next.lecture.title}</div>
          <div className="tnum text-sm">
            {next.chapter.name}
            {next.lecture.minutes > 0 ? ` · ${fmtHM(next.lecture.minutes)}` : ''}
            {next.lecture.pct ? ` · ${next.lecture.pct}% already watched` : ''}
          </div>
          <Button className="mt-2" variant="primary" onClick={() => onChange(toggleLecture(next.chapter, next.lecture.id))}>
            Mark watched
          </Button>
        </div>
      ) : (
        <p className="mb-4 border-2 border-ink bg-[var(--p4)] p-3 text-sm font-bold text-[var(--on-color)]">All {rows.length} lectures watched.</p>
      )}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="tnum text-sm text-ink-2">
          {doneCount} of {rows.length} watched
        </span>
        <Seg
          value={show}
          onChange={setShow}
          options={[
            { id: 'next', label: 'Next 10' },
            { id: 'all', label: `All ${rows.length}` },
          ]}
        />
      </div>
      <ul className="divide-y-2 divide-ink border-2 border-ink">
        {shown.map((r) => (
          <li key={`${r.chapter.id}-${r.lecture.id}`} className={cx('flex items-center gap-3 px-3 py-2', r === next && 'bg-surface-2')}>
            <span className="tnum w-9 shrink-0 text-right text-xs text-ink-3">{r.n}</span>
            <input type="checkbox" aria-label={`Watched: ${r.lecture.title}`} checked={r.lecture.done} onChange={() => onChange(toggleLecture(r.chapter, r.lecture.id))} />
            <div className="min-w-0 flex-1">
              <div className={cx('text-sm', r.lecture.done && 'text-ink-3 line-through')}>
                {r.lecture.title}
                {!r.lecture.done && r.lecture.pct ? <span className="ml-2 text-xs font-bold text-accent">{r.lecture.pct}% watched</span> : null}
              </div>
              <div className="truncate text-xs text-ink-3">{r.chapter.name}</div>
            </div>
            <span className="tnum shrink-0 text-xs text-ink-2">{r.lecture.minutes > 0 ? fmtHM(r.lecture.minutes) : '—'}</span>
          </li>
        ))}
        {shown.length === 0 && <li className="px-3 py-3 text-sm text-ink-3">Nothing left to watch.</li>}
      </ul>
    </div>
  )
}
