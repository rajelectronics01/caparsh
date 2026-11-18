import { useState } from 'react'
import { toggleLecture } from '../lib/actions'
import { fmtHM, uid } from '../lib/dates'
import type { Chapter, Lecture } from '../lib/types'
import { Button, ConfirmButton, cx, num } from './ui'

/** One chapter's recorded lectures: tick them off, fix a length, add or remove one. */
export interface ChapterChoice {
  id: string
  name: string
  ok: boolean // can receive a lecture (it has a list, or no lectures yet)
}

export function LectureChecklist({ chapter, onChange, chapters, onMoveTo }: { chapter: Chapter; onChange: (c: Chapter) => void; chapters?: ChapterChoice[]; onMoveTo?: (lecture: Lecture, toChapterId: string) => void }) {
  const list = chapter.lectures ?? []
  const [title, setTitle] = useState('')
  const [min, setMin] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [eTitle, setETitle] = useState('')
  const [eMin, setEMin] = useState('')
  const [eChap, setEChap] = useState(chapter.id)
  const write = (lectures: NonNullable<Chapter['lectures']>) => onChange({ ...chapter, lectures, totalLectures: lectures.length })

  const add = () => {
    if (!title.trim()) return
    write([...list, { id: `${chapter.id}-${uid().slice(0, 8)}`, title: title.trim(), minutes: Math.max(0, Math.round(num(min))), done: false }])
    setTitle('')
    setMin('')
  }
  const saveEdit = (id: string) => {
    if (!eTitle.trim()) return
    const edited = list.map((l) => (l.id === id ? { ...l, title: eTitle.trim(), minutes: Math.max(0, Math.round(num(eMin))) } : l))
    if (eChap !== chapter.id && onMoveTo) {
      // Take it out of this chapter and hand it to the chosen one.
      const moving = edited.find((l) => l.id === id)!
      write(edited.filter((l) => l.id !== id))
      onMoveTo(moving, eChap)
    } else write(edited)
    setEditing(null)
  }

  return (
    <div className="border-2 border-ink bg-surface-2 p-3">
      {list.length > 0 && (
        <ul className="divide-y divide-ink/30">
          {list.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
              {editing === l.id ? (
                <>
                  <input aria-label="Lecture title" className="inp min-w-40 flex-1" value={eTitle} onChange={(e) => setETitle(e.target.value)} />
                  <input aria-label="Length in minutes" type="number" min="0" inputMode="numeric" placeholder="min" className="inp tnum w-24" value={eMin} onChange={(e) => setEMin(e.target.value)} />
                  {chapters && onMoveTo && (
                    <select aria-label="Chapter" className="inp min-w-48 flex-1" value={eChap} onChange={(e) => setEChap(e.target.value)}>
                      {chapters.map((c) => (
                        <option key={c.id} value={c.id} disabled={!c.ok && c.id !== chapter.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <Button size="sm" variant="primary" onClick={() => saveEdit(l.id)}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <label className="flex min-h-9 min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                    <input type="checkbox" aria-label={`Watched: ${l.title}`} checked={l.done} onChange={() => onChange(toggleLecture(chapter, l.id))} />
                    <span className={cx('min-w-0 text-sm', l.done && 'text-ink-3 line-through')}>
                      {l.title}
                      {!l.done && l.pct ? <span className="ml-2 text-xs font-bold text-accent no-underline">{l.pct}% watched</span> : null}
                    </span>
                  </label>
                  <span className="tnum shrink-0 text-xs text-ink-2">{l.minutes > 0 ? fmtHM(l.minutes) : 'length not listed'}</span>
                  <span className="shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(l.id)
                        setEChap(chapter.id)
                        setETitle(l.title)
                        setEMin(l.minutes ? String(l.minutes) : '')
                      }}
                    >
                      Edit
                    </Button>
                    <ConfirmButton onConfirm={() => write(list.filter((x) => x.id !== l.id))} />
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-2 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <input aria-label="New lecture title" className="inp min-w-40 flex-1" placeholder={list.length ? 'Add a lecture' : 'Add the first lecture of this chapter'} value={title} onChange={(e) => setTitle(e.target.value)} />
        <input aria-label="New lecture length in minutes" type="number" min="0" inputMode="numeric" placeholder="min" className="inp tnum w-24" value={min} onChange={(e) => setMin(e.target.value)} />
        <Button type="submit" disabled={!title.trim()}>
          + Add
        </Button>
      </form>
    </div>
  )
}
