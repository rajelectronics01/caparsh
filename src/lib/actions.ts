import { today } from './dates'
import type { Chapter, RevisionEntry } from './types'

/**
 * Tick (n > 0) the next unwatched lectures, or untick (n < 0) the most recently ticked ones.
 * With a lecture list the list is updated; without one a dated +/- mark is added.
 */
export function markLecture(ch: Chapter, n: number): Chapter {
  const t = today()
  if (ch.lectures?.length) {
    const ls = ch.lectures.map((l) => ({ ...l }))
    if (n > 0) {
      let k = n
      for (const l of ls) {
        if (k <= 0) break
        if (!l.done) {
          l.done = true
          l.pct = undefined
          l.doneAt = t
          k--
        }
      }
    } else {
      let k = -n
      for (let i = ls.length - 1; i >= 0 && k > 0; i--)
        if (ls[i].done) {
          ls[i].done = false
          ls[i].doneAt = undefined
          k--
        }
    }
    return { ...ch, lectures: ls }
  }
  const marks = ch.lectureMarks.slice()
  const i = marks.findIndex((m) => m.date === t)
  if (i >= 0) marks[i] = { date: t, n: marks[i].n + n }
  else marks.push({ date: t, n })
  return { ...ch, lectureMarks: marks.filter((m) => m.n !== 0) }
}

/** Tick or untick one specific lecture. */
export function toggleLecture(ch: Chapter, id: string): Chapter {
  const ls = (ch.lectures ?? []).map((l) => {
    if (l.id !== id) return l
    return l.done ? { ...l, done: false, doneAt: undefined } : { ...l, done: true, pct: undefined, doneAt: today() }
  })
  return { ...ch, lectures: ls }
}

export function setRevision(ch: Chapter, i: number, patch: Partial<RevisionEntry>): Chapter {
  const revisions = ch.revisions.map((r, j) => (j === i ? { ...r, ...patch } : r))
  if (patch.done === true && !revisions[i].date) revisions[i].date = today()
  if (patch.done === false) revisions[i] = { done: false }
  return { ...ch, revisions }
}

/** Tick exactly these lectures (by id), dating them to the day they were watched. */
export function tickLectures(ch: Chapter, ids: string[], date: string): Chapter {
  if (!ch.lectures?.length || !ids.length) return ch
  const set = new Set(ids)
  return { ...ch, lectures: ch.lectures.map((l) => (set.has(l.id) && !l.done ? { ...l, done: true, pct: undefined, doneAt: date } : l)) }
}
