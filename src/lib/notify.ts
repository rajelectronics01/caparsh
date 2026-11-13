import { useEffect } from 'react'
import { backend, VAPID_PUBLIC_KEY } from './backend'
import { diffDays, today } from './dates'
import type { Reminder, Settings } from './types'

export const notifySupported = () => 'Notification' in window && 'serviceWorker' in navigator
export const pushConfigured = () => backend.mode === 'cloud' && !!VAPID_PUBLIC_KEY && 'PushManager' in window

export async function registerSW() {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch {
    return null
  }
}

const b64ToBytes = (b64: string) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}

/** Ask for permission and, when the push server is configured, register this device for closed-app alerts. */
export async function enableAlerts(uid: string, reminders: Reminder[]): Promise<'push' | 'local' | 'denied' | 'unsupported'> {
  if (!notifySupported()) return 'unsupported'
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return 'denied'
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await registerSW())
  if (!reg || !pushConfigured()) return 'local'
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC_KEY!) }))
  await backend.savePush(uid, sub.toJSON(), reminders, Intl.DateTimeFormat().resolvedOptions().timeZone)
  return 'push'
}

/** Keep the server copy of reminder times in step with settings (no-op unless this device is subscribed). */
export async function syncPush(uid: string, reminders: Reminder[]) {
  if (!pushConfigured() || Notification.permission !== 'granted') return
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) await backend.savePush(uid, sub.toJSON(), reminders, Intl.DateTimeFormat().resolvedOptions().timeZone)
}

export async function disableAlerts() {
  const reg = await navigator.serviceWorker?.getRegistration()
  const sub = await reg?.pushManager?.getSubscription()
  if (sub) {
    await backend.removePush(sub.endpoint).catch(() => {})
    await sub.unsubscribe()
  }
}

export async function showNotification(title: string, body: string, tag: string) {
  if (!notifySupported() || Notification.permission !== 'granted') return false
  const reg = await navigator.serviceWorker.getRegistration()
  if (reg) await reg.showNotification(title, { body, tag, icon: '/icon.svg', badge: '/icon.svg' })
  else new Notification(title, { body, tag })
  return true
}

/** While the app is open, fire each enabled reminder once per day at its time (the tag de-duplicates against server push). */
export function useReminders(settings: Settings, onFire: (r: Reminder) => void) {
  useEffect(() => {
    const check = () => {
      const now = new Date()
      const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const d = today()
      for (const r of settings.reminders) {
        if (!r.enabled || r.time > hm) continue
        // Only fire within 10 minutes of the set time, so opening the app at night does not replay the morning alert.
        const [h, m] = r.time.split(':').map(Number)
        if (now.getHours() * 60 + now.getMinutes() - (h * 60 + m) > 10) continue
        const key = `pct.fired.${r.id}`
        if (localStorage.getItem(key) === d) continue
        localStorage.setItem(key, d)
        const left = diffDays(d, settings.examDate)
        void showNotification('Parsh CA Tracker', `${r.label}${left > 0 ? ` · ${left} days to the exam` : ''}`, `rem-${r.id}-${d}`)
        onFire(r)
      }
    }
    check()
    const t = setInterval(check, 20000)
    return () => clearInterval(t)
  }, [settings.reminders, settings.examDate, onFire])
}
