// Supabase Edge Function: sends due study reminders as Web Push.
// Called every 5 minutes by pg_cron (see supabase/reminders.sql). Protected by CRON_SECRET.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

import { dueReminders, localNow, type Sub } from './due.ts'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  const env = (k: string) => Deno.env.get(k) ?? ''
  const secret = env('CRON_SECRET')
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return json({ error: 'unauthorized' }, 401)
  if (!env('VAPID_PUBLIC_KEY') || !env('VAPID_PRIVATE_KEY')) return json({ error: 'push is not configured' }, 500)

  webpush.setVapidDetails(env('VAPID_SUBJECT') || env('SUPABASE_URL'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'))
  const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
  const { data: subs, error } = await sb.from('push_subscriptions').select('*')
  if (error) return json({ error: error.message }, 500)

  // ?test=1 sends one notification to every registered device straight away (used by "Send test from server").
  const test = new URL(req.url).searchParams.get('test') === '1'
  const now = new Date()
  let sentCount = 0
  let removed = 0
  const failures: string[] = []
  for (const sub of (subs ?? []) as Sub[]) {
    const { due, date } = test ? { due: [{ id: 'test', time: '', label: 'Test alert from the server', enabled: true }], date: localNow(sub.tz || 'Asia/Kolkata', now).date } : dueReminders(sub, now)
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
        else failures.push(`${code ?? 'error'}: ${String((e as Error).message).slice(0, 120)}`)
      }
    }
    if (gone) {
      await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      removed++
    } else if (!test) {
      const keep = (sub.sent ?? []).filter((k) => k.startsWith(`${date}|`))
      await sb.from('push_subscriptions').update({ sent: [...keep, ...due.map((r) => `${date}|${r.id}`)] }).eq('endpoint', sub.endpoint)
    }
  }
  return json({ ok: true, subscriptions: subs?.length ?? 0, sent: sentCount, removed, failures })
})
