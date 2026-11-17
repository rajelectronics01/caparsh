import { uid } from '../lib/dates'
import { useEffect, useRef, useState } from 'react'
import { useTheme } from '../components/Layout'
import { Badge, Button, Card, Check, ConfirmButton, Field, num, PageHeader, Seg, useToast, cx } from '../components/ui'
import { backend } from '../lib/backend'
import { exportBackup, exportExcel, exportSessionsCSV, importSpreadsheet, parseBackup } from '../lib/exporter'
import { disableAlerts, enableAlerts, notifySupported, pushConfigured, showNotification, syncPush } from '../lib/notify'
import { seedRecords } from '../lib/seed'
import { assemble, useStore } from '../lib/store'
import type { DayType, Reminder } from '../lib/types'
import { LinkFriend } from './Compare'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function Settings() {
  const { data, user, setSettings, replaceAll, putMany, friends, refreshFriends, renameSelf, mode } = useStore()
  const s = data.settings
  const toast = useToast()
  const [theme, setTheme] = useTheme()
  const [name, setName] = useState(user?.name ?? '')
  const [perm, setPerm] = useState(notifySupported() ? Notification.permission : 'unsupported')
  const [busy, setBusy] = useState('')
  const installed = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
  const backupRef = useRef<HTMLInputElement>(null)
  const sheetRef = useRef<HTMLInputElement>(null)

  // Keep the push server's copy of the reminder times current.
  useEffect(() => {
    if (user) void syncPush(user.id, s.reminders).catch(() => {})
  }, [user, s.reminders])

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label)
    try {
      await fn()
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setBusy('')
    }
  }
  const setRem = (id: string, patch: Partial<Reminder>) => setSettings({ reminders: s.reminders.map((r) => (r.id === id ? { ...r, ...patch } : r)) })

  const restore = (file: File) =>
    run('restore', async () => {
      const d = parseBackup(await file.text())
      if (!window.confirm(`Restore this backup? It replaces everything currently in the tracker with ${d.sessions.length} sessions, ${d.chapters.length} chapters and ${d.tests.length} tests from the file.`)) return
      replaceAll(d)
      toast('Backup restored')
    })
  const importSheet = (file: File) =>
    run('import', async () => {
      const r = await importSpreadsheet(file, data)
      if (!r.sessions.length && !r.tests.length) throw new Error(r.skipped ? `No valid rows found (${r.skipped} rows failed validation).` : 'No Sessions or Tests sheet found in this file.')
      putMany([...r.sessions.map((x) => ({ collection: 'sessions' as const, id: x.id, data: x })), ...r.tests.map((x) => ({ collection: 'tests' as const, id: x.id, data: x }))])
      toast(`Imported ${r.sessions.length} sessions and ${r.tests.length} tests${r.skipped ? `, skipped ${r.skipped} invalid rows` : ''}`)
    })

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Profile">
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Display name" className="min-w-48 flex-1">
              <input className="inp" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Button disabled={!name.trim() || name === user?.name} onClick={() => run('name', async () => (await renameSelf(name.trim()), toast('Name updated')))}>
              Save
            </Button>
          </div>
          <p className="mt-3 text-[13px] text-ink-3">
            {mode === 'cloud' ? `Signed in as ${user?.email}. Data is stored in your Supabase database and syncs across devices.` : 'Local mode: data is stored in this browser only. Take backups, or connect Supabase (see README) for cloud sync.'}
          </p>
          <div className="mt-4 sm:hidden">
            <Button onClick={() => void backend.signOut()}>{mode === 'local' ? 'Switch profile' : 'Sign out'}</Button>
          </div>
        </Card>

        <Card title="Appearance">
          <Seg value={theme as 'light' | 'dark' | 'system'} onChange={setTheme} options={[{ id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }, { id: 'system', label: 'System' }]} />
        </Card>

        <Card title="Exam dates">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Exam date" hint="ICAI has not announced September 2027 dates yet; update when it does.">
              <input type="date" className="inp" value={s.examDate} onChange={(e) => e.target.value && setSettings({ examDate: e.target.value })} />
            </Field>
            <Field label="Preparation start">
              <input type="date" className="inp" value={s.startDate} onChange={(e) => e.target.value && setSettings({ startDate: e.target.value })} />
            </Field>
          </div>
        </Card>

        <Card title="College and daily targets">
          <p className="mb-2 text-[13px] font-medium text-ink-2">College days</p>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d, i) => {
              const on = s.collegeDays.includes(i)
              return (
                <button key={d} aria-pressed={on} onClick={() => setSettings({ collegeDays: on ? s.collegeDays.filter((x) => x !== i) : [...s.collegeDays, i].sort() })} className={cx('press min-h-9 border-2 px-3 text-sm font-bold uppercase', on ? 'border-ink bg-hi font-bold text-hi-ink' : 'border-ink bg-surface text-ink')}>
                  {d}
                </button>
              )
            })}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Field label="College starts">
              <input type="time" className="inp" value={s.collegeStart} onChange={(e) => e.target.value && setSettings({ collegeStart: e.target.value })} />
            </Field>
            <Field label="College ends">
              <input type="time" className="inp" value={s.collegeEnd} onChange={(e) => e.target.value && setSettings({ collegeEnd: e.target.value })} />
            </Field>
            <Field label="Home by">
              <input type="time" className="inp" value={s.homeBy} onChange={(e) => e.target.value && setSettings({ homeBy: e.target.value })} />
            </Field>
          </div>
          <p className="mb-2 mt-5 text-[13px] font-medium text-ink-2">Daily study target (hours) by day type</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(['normal', 'busy', 'exam', 'holiday'] as DayType[]).map((k) => (
              <Field key={k} label={k[0].toUpperCase() + k.slice(1)}>
                <input type="number" min="0" max="16" step="0.5" className="inp" value={s.dailyTargetHours[k]} onChange={(e) => setSettings({ dailyTargetHours: { ...s.dailyTargetHours, [k]: Math.max(0, Math.min(16, num(e.target.value))) } })} />
              </Field>
            ))}
          </div>
        </Card>

        <Card title="Daily alerts" sub="Reminders at the times you choose.">
          <div className="space-y-2.5">
            {s.reminders.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2">
                <input type="time" aria-label="Reminder time" className="inp w-auto!" value={r.time} onChange={(e) => e.target.value && setRem(r.id, { time: e.target.value })} />
                <input aria-label="Reminder message" className="inp min-w-40 flex-1" value={r.label} onChange={(e) => setRem(r.id, { label: e.target.value })} />
                <Check label="On" checked={r.enabled} onChange={(v) => setRem(r.id, { enabled: v })} />
                <ConfirmButton label="Remove" onConfirm={() => setSettings({ reminders: s.reminders.filter((x) => x.id !== r.id) })} />
              </div>
            ))}
            {s.reminders.length === 0 && <p className="text-sm text-ink-3">No reminders set.</p>}
          </div>
          <Button size="sm" className="mt-3" onClick={() => setSettings({ reminders: [...s.reminders, { id: uid(), time: '20:00', label: 'Log today’s study', enabled: true }] })}>
            + Add reminder
          </Button>
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <Badge tone={perm === 'granted' ? 'good' : perm === 'denied' ? 'bad' : 'neutral'}>{perm === 'granted' ? 'Notifications allowed' : perm === 'denied' ? 'Blocked in browser settings' : perm === 'unsupported' ? 'Not supported in this browser' : 'Not enabled yet'}</Badge>
            {perm !== 'unsupported' && (
              <Button
                size="sm"
                variant="primary"
                disabled={busy === 'alerts'}
                onClick={() =>
                  run('alerts', async () => {
                    const r = await enableAlerts(user!.id, s.reminders)
                    setPerm(Notification.permission)
                    toast(r === 'push' ? 'Alerts on: this device will be notified even when the app is closed' : r === 'local' ? 'Alerts on while the app is open' : 'Notifications were not allowed', r === 'denied' ? 'bad' : 'good')
                  })
                }
              >
                {perm === 'granted' ? 'Re-register this device' : 'Enable alerts on this device'}
              </Button>
            )}
            {perm === 'granted' && (
              <>
                <Button size="sm" onClick={() => void showNotification('Parsh CA Tracker', 'Test alert: this is how reminders will look.', 'test')}>
                  Send test
                </Button>
                <Button size="sm" variant="ghost" onClick={() => run('off', async () => (await disableAlerts(), toast('Closed-app alerts turned off for this device')))}>
                  Turn off push
                </Button>
              </>
            )}
          </div>
          <ol className="mt-4 space-y-1.5 text-sm">
            {[
              { ok: installed, label: 'App added to the Home Screen', help: 'iPhone: open in Safari → Share → Add to Home Screen. Android: Chrome menu → Install app.' },
              { ok: perm === 'granted', label: 'Notifications allowed on this device', help: 'Open the installed app and press “Enable alerts on this device”.' },
              { ok: pushConfigured(), label: 'Push server connected', help: 'One-time setup on the deployed site (README, “Closed-app alerts”). Until then alerts fire only while the app is open.' },
            ].map((x, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className={cx('tnum mt-0.5 grid size-5 shrink-0 place-items-center border-2 border-ink text-xs font-bold', x.ok ? 'bg-good-soft' : 'bg-surface')}>{x.ok ? '✓' : i + 1}</span>
                <span>
                  <span className="font-bold">{x.label}</span>
                  {!x.ok && <span className="block text-[13px] text-ink-3">{x.help}</span>}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[13px] text-ink-3">
            {pushConfigured()
              ? 'Push is configured: alerts arrive even when the app is closed. On iPhone, first add the app to your Home Screen (Share → Add to Home Screen), then enable alerts from inside it.'
              : 'Closed-app push is not configured on this deployment, so reminders fire only while the app is open in a tab or installed window. The README explains the one-time push setup.'}
          </p>
        </Card>

        <Card title="Friends" sub="Each friend has a separate account and their own data.">
          {friends.length > 0 && (
            <ul className="mb-4 divide-y divide-line rounded-lg border border-line">
              {friends.map((f) => (
                <li key={f.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>{f.name}</span>
                  <ConfirmButton label="Unlink" onConfirm={() => run('unlink', async () => (await backend.unlinkFriend(user!.id, f.id), await refreshFriends(), toast('Friend unlinked')))} />
                </li>
              ))}
            </ul>
          )}
          <LinkFriend />
        </Card>

        <Card title="Data" sub="Everything saves automatically. Keep an occasional backup anyway." className="lg:col-span-2">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-[13px] font-medium text-ink-2">Export</p>
              <div className="flex flex-wrap gap-2">
                <Button disabled={!!busy} onClick={() => run('xlsx', () => exportExcel(data))}>
                  Excel workbook
                </Button>
                <Button disabled={!!busy} onClick={() => run('csv', () => exportSessionsCSV(data))}>
                  Sessions CSV
                </Button>
                <Button onClick={() => exportBackup(data)}>Full backup (JSON)</Button>
              </div>
              <p className="mt-2 text-[13px] text-ink-3">The Excel workbook has sheets for sessions, tests, chapters, subjects, planner and days. The JSON backup is the complete, lossless copy.</p>
            </div>
            <div>
              <p className="mb-2 text-[13px] font-medium text-ink-2">Import and restore</p>
              <div className="flex flex-wrap gap-2">
                <Button disabled={!!busy} onClick={() => backupRef.current?.click()}>
                  Restore from backup
                </Button>
                <Button disabled={!!busy} onClick={() => sheetRef.current?.click()}>
                  Import Excel / CSV
                </Button>
              </div>
              <input ref={backupRef} type="file" accept=".json,application/json" className="hidden" aria-label="Backup file" onChange={(e) => (e.target.files?.[0] && void restore(e.target.files[0]), (e.target.value = ''))} />
              <input ref={sheetRef} type="file" accept=".xlsx,.csv" className="hidden" aria-label="Spreadsheet file" onChange={(e) => (e.target.files?.[0] && void importSheet(e.target.files[0]), (e.target.value = ''))} />
              <p className="mt-2 text-[13px] text-ink-3">Restore replaces all data with the backup. Excel/CSV import adds or updates sessions and tests from a file this app exported; invalid rows are skipped and counted.</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <ConfirmButton
              label="Reset all data"
              onConfirm={() => {
                if (window.confirm('Delete every session, test, plan and all progress, and reset subjects and chapters to the starting syllabus? This cannot be undone. Export a backup first if unsure.')) {
                  replaceAll(assemble(seedRecords()))
                  toast('Tracker reset')
                }
              }}
            />
            <span className="text-[13px] text-ink-3">Clears everything and reloads the starting syllabus.</span>
          </div>
        </Card>
      </div>
    </>
  )
}
