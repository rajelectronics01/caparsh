// Pure logic for "a friend studied" alerts, shared by the Edge Function and the unit tests.

/** At most one alert per sender and recipient in this many minutes, so a day of logging does not become spam. */
export const THROTTLE_MIN = 15

export const fmtDuration = (min: number) => {
  const m = Math.round(min)
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h === 0) return `${r}m`
  return r === 0 ? `${h}h` : `${h}h ${r}m`
}

export function buildAlert(senderName: string, subject: string, minutes: number) {
  const name = senderName.trim() || 'Your friend'
  return {
    title: `${name} just studied`,
    body: `${name} did ${subject} for ${fmtDuration(minutes)}. Tum bhi padho, warna tum gaye!`,
  }
}

/** Only fresh study triggers an alert: a session dated yesterday, today or tomorrow (covers every time zone). Restoring an old backup stays silent. */
export function isFresh(sessionDate: unknown, now = new Date()) {
  if (typeof sessionDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) return false
  const day = (offset: number) => new Date(now.getTime() + offset * 86400000).toISOString().slice(0, 10)
  return sessionDate >= day(-1) && sessionDate <= day(1)
}

export function isThrottled(lastSentIso: string | null | undefined, now = new Date()) {
  if (!lastSentIso) return false
  return now.getTime() - Date.parse(lastSentIso) < THROTTLE_MIN * 60000
}

export interface SessionPayload {
  date?: unknown
  subjectId?: unknown
  durationMin?: unknown
}
/** Whether the saved session is worth telling friends about. */
export function isAlertable(s: SessionPayload | null | undefined, now = new Date()) {
  return !!s && typeof s.subjectId === 'string' && typeof s.durationMin === 'number' && s.durationMin > 0 && isFresh(s.date, now)
}
