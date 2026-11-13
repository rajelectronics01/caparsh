import { today } from './dates'
import type { Chapter, RevisionEntry } from './types'

/** Add (or remove, with a negative n) manually marked lectures, dated today so weekly counts stay right. */
export function markLecture(ch: Chapter, n: number): Chapter {
  const t = today()
  const marks = ch.lectureMarks.slice()
  const i = marks.findIndex((m) => m.date === t)
  if (i >= 0) marks[i] = { date: t, n: marks[i].n + n }
  else marks.push({ date: t, n })
  return { ...ch, lectureMarks: marks.filter((m) => m.n !== 0) }
}

export function setRevision(ch: Chapter, i: number, patch: Partial<RevisionEntry>): Chapter {
  const revisions = ch.revisions.map((r, j) => (j === i ? { ...r, ...patch } : r))
  if (patch.done === true && !revisions[i].date) revisions[i].date = today()
  if (patch.done === false) revisions[i] = { done: false }
  return { ...ch, revisions }
}
