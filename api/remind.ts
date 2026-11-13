// Vercel serverless function: sends due study reminders as Web Push.
// Called every 5 minutes by Supabase pg_cron (see supabase/schema.sql). Protected by CRON_SECRET.
import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import webpush from 'web-push'

interface Reminder {
  id: string
  time: string
  label: string
  enabled: boolean
}
interface Sub {
  endpoint: string
  user_id: string
  p256dh: string
  auth: string
  tz: string
  reminders: Reminder[] | null
  sent: string[] | null
}

const WINDOW_MIN = 6

/** Local date (YYYY-MM-DD) and minutes since midnight in an IANA time zone. */
export function localNow(tz: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)!.value
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) }
}

/** Reminders whose time fell within the last WINDOW_MIN minutes and have not been sent today. */
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
    const m = Number(r.time.slice(0, 2)) * 60 + Number(r.time.slice(3))
    const diff = local.minutes - m
    return diff >= 0 && diff < WINDOW_MIN && !sent.has(`${local.date}|${r.id}`)
  })
  return { due, date: local.date }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env
  if (!CRON_SECRET || req.headers.authorization !== `Bearer ${CRON_SECRET}`) return res.status(401).json({ error: 'unauthorized' })
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return res.status(500).json({ error: 'push is not configured' })

  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:admin@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data: subs, error } = await sb.from('push_subscriptions').select('*')
  if (error) return res.status(500).json({ error: error.message })

  const now = new Date()
  let sentCount = 0
  let removed = 0
  for (const sub of (subs ?? []) as Sub[]) {
    const { due, date } = dueReminders(sub, now)
    if (!due.length) continue
    const { data: st } = await sb.from('records').select('data').eq('user_id', sub.user_id).eq('collection', 'settings').eq('id', 'settings').maybeSingle()
    const exam = (st?.data as { examDate?: string } | undefined)?.examDate
    const left = exam ? Math.round((Date.parse(exam) - Date.parse(date)) / 86400000) : 0
    let gone = false
    for (const r of due) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: 'Parsh CA Tracker', body: `${r.label}${left > 0 ? ` · ${left} days to the exam` : ''}`, tag: `rem-${r.id}-${date}`, url: '/' }),
          { TTL: 1800 },
        )
        sentCount++
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) gone = true // subscription expired or revoked
      }
    }
    if (gone) {
      await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      removed++
    } else {
      const keep = (sub.sent ?? []).filter((k) => k.startsWith(`${date}|`))
      await sb.from('push_subscriptions').update({ sent: [...keep, ...due.map((r) => `${date}|${r.id}`)] }).eq('endpoint', sub.endpoint)
    }
  }
  return res.status(200).json({ ok: true, subscriptions: subs?.length ?? 0, sent: sentCount, removed })
}
