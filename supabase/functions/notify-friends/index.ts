// Supabase Edge Function: tells a user's linked friends, by push notification, that they just studied.
// Called by a database trigger whenever a new study session is saved (see supabase/friend-alerts.sql).
// Protected by CRON_SECRET (the same shared secret the reminder function uses).
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { buildAlert, isAlertable, isThrottled, type SessionPayload } from './alert.ts'

interface Sub {
  endpoint: string
  user_id: string
  p256dh: string
  auth: string
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  const env = (k: string) => Deno.env.get(k) ?? ''
  const secret = env('CRON_SECRET')
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return json({ error: 'unauthorized' }, 401)
  if (!env('VAPID_PUBLIC_KEY') || !env('VAPID_PRIVATE_KEY')) return json({ error: 'push is not configured' }, 500)

  let body: { user_id?: string; data?: SessionPayload }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad request' }, 400)
  }
  const sender = body.user_id
  if (!sender || !UUID.test(sender)) return json({ error: 'bad user' }, 400)
  const now = new Date()
  if (!isAlertable(body.data, now)) return json({ ok: true, skipped: 'not a fresh study session' })

  webpush.setVapidDetails(env('VAPID_SUBJECT') || env('SUPABASE_URL'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'))
  const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

  const { data: links, error } = await sb.from('friend_links').select('friend_id').eq('user_id', sender)
  if (error) return json({ error: error.message }, 500)
  const friendIds = (links ?? []).map((l) => l.friend_id as string)
  if (!friendIds.length) return json({ ok: true, friends: 0, sent: 0 })

  const { data: prof } = await sb.from('profiles').select('display_name').eq('id', sender).maybeSingle()
  const { data: subj } = await sb.from('records').select('data').eq('user_id', sender).eq('collection', 'subjects').eq('id', String(body.data!.subjectId)).maybeSingle()
  const subjData = subj?.data as { short?: string; name?: string } | undefined
  const subjectName = subjData?.short || subjData?.name || 'a subject'
  const alert = buildAlert(prof?.display_name ?? '', subjectName, body.data!.durationMin as number)

  const result = { ok: true, friends: friendIds.length, sent: 0, throttled: 0, off: 0, noDevice: 0, removed: 0, failures: [] as string[] }
  for (const friend of friendIds) {
    const { data: st } = await sb.from('records').select('data').eq('user_id', friend).eq('collection', 'settings').eq('id', 'settings').maybeSingle()
    if ((st?.data as { friendAlerts?: boolean } | undefined)?.friendAlerts === false) {
      result.off++
      continue
    }
    const { data: log } = await sb.from('notify_log').select('sent_at').eq('sender_id', sender).eq('recipient_id', friend).maybeSingle()
    if (isThrottled(log?.sent_at, now)) {
      result.throttled++
      continue
    }
    const { data: subs } = await sb.from('push_subscriptions').select('endpoint, user_id, p256dh, auth').eq('user_id', friend)
    if (!subs?.length) {
      result.noDevice++
      continue
    }
    let delivered = 0
    for (const sub of subs as Sub[]) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({ ...alert, tag: `friend-${sender}`, url: '/compare' }), { TTL: 3600 })
        delivered++
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) {
          await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
          result.removed++
        } else result.failures.push(`${code ?? 'error'}: ${String((e as Error).message).slice(0, 100)}`)
      }
    }
    if (delivered > 0) {
      result.sent += delivered
      await sb.from('notify_log').upsert({ sender_id: sender, recipient_id: friend, sent_at: now.toISOString() }, { onConflict: 'sender_id,recipient_id' })
    }
  }
  return json(result)
})
