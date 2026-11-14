// Pure reminder timing logic, shared by the Edge Function and the unit tests.
export interface Reminder {
  id: string
  time: string
  label: string
  enabled: boolean
}
export interface Sub {
  endpoint: string
  user_id: string
  p256dh: string
  auth: string
  tz: string
  reminders: Reminder[] | null
  sent: string[] | null
}

const WINDOW_MIN = 6

export function localNow(tz: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)!.value
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) }
}

export function dueReminders(sub: Pick<Sub, 'reminders' | 'sent' | 'tz'>, now = new Date()) {
  let local
  try {
    local = localNow(sub.tz || 'Asia/Kolkata', now)
  } catch {
    local = localNow('Asia/Kolkata', now)
  }
  const sent = new Set(sub.sent ?? [])
  const due = (sub.reminders ?? []).filter((r) => {
    if (!r.enabled || !/^\d{2}:\d{2}$/.test(r.time)) return false
    const diff = local.minutes - (Number(r.time.slice(0, 2)) * 60 + Number(r.time.slice(3)))
    return diff >= 0 && diff < WINDOW_MIN && !sent.has(`${local.date}|${r.id}`)
  })
  return { due, date: local.date }
}
