import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { backend } from '../lib/backend'
import { minToTime, toISO } from '../lib/dates'
import { useReminders } from '../lib/notify'
import { useStore } from '../lib/store'
import type { Session } from '../lib/types'
import { SessionForm } from './SessionForm'
import { Button, cx, useToast } from './ui'

const NAV: { group: string; items: { to: string; label: string }[] }[] = [
  {
    group: 'Track',
    items: [
      { to: '/', label: 'Overview' },
      { to: '/log', label: 'Daily Study Log' },
      { to: '/planner', label: 'Study Planner' },
    ],
  },
  {
    group: 'Syllabus',
    items: [
      { to: '/subjects', label: 'Subjects' },
      { to: '/syllabus', label: 'Syllabus Tracker' },
      { to: '/lectures', label: 'Lecture Tracker' },
      { to: '/practice', label: 'Question Practice' },
      { to: '/revision', label: 'Revision Manager' },
      { to: '/tests', label: 'Tests & Performance' },
    ],
  },
  {
    group: 'Review',
    items: [
      { to: '/backlog', label: 'Backlog Manager' },
      { to: '/weekly', label: 'Weekly Review' },
      { to: '/monthly', label: 'Monthly Analytics' },
      { to: '/compare', label: 'Compare with Friend' },
    ],
  },
  { group: '', items: [{ to: '/settings', label: 'Settings' }] },
]

export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('pct.theme') || 'system')
  useEffect(() => {
    localStorage.setItem('pct.theme', theme)
    const apply = () => {
      document.documentElement.dataset.theme = theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme
    }
    apply()
    const mq = matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
  return [theme, setTheme] as const
}

function SyncChip() {
  const { sync, mode } = useStore()
  const offline = !!sync.error
  const label = offline ? `Not synced (${sync.pending})` : sync.pending || sync.saving ? 'Saving…' : mode === 'cloud' ? 'Saved' : 'Saved on this device'
  return (
    <span title={sync.error ?? ''} className={cx('inline-flex items-center gap-1.5 text-[12.5px]', offline ? 'text-bad' : 'text-ink-3')}>
      <span className={cx('size-1.5 rounded-full', offline ? 'bg-bad' : sync.pending ? 'bg-warn' : 'bg-good')} />
      {label}
    </span>
  )
}

/** Stopwatch that survives reloads; stopping it opens the session form with the times filled in. */
function StudyTimer({ onStop }: { onStop: (s: Partial<Session>) => void }) {
  const [start, setStart] = useState<number | null>(() => Number(localStorage.getItem('pct.timer')) || null)
  const [, tick] = useState(0)
  useEffect(() => {
    if (!start) return
    const t = setInterval(() => tick((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [start])
  if (!start)
    return (
      <Button
        size="sm"
        onClick={() => {
          const now = Date.now()
          localStorage.setItem('pct.timer', String(now))
          setStart(now)
        }}
      >
        ▶ Start timer
      </Button>
    )
  const sec = Math.floor((Date.now() - start) / 1000)
  const hh = String(Math.floor(sec / 3600)).padStart(2, '0')
  const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0')
  const ss = String(sec % 60).padStart(2, '0')
  return (
    <div className="inline-flex items-center gap-2">
      <span className="tnum rounded-lg bg-accent-soft px-2.5 py-1 text-sm font-semibold text-accent" aria-label="Elapsed study time">
        {hh}:{mm}:{ss}
      </span>
      <Button
        size="sm"
        variant="primary"
        onClick={() => {
          const s = new Date(start)
          const e = new Date()
          localStorage.removeItem('pct.timer')
          setStart(null)
          const mins = Math.max(1, Math.round((e.getTime() - s.getTime()) / 60000))
          const startMin = s.getHours() * 60 + s.getMinutes()
          onStop({ date: toISO(s), start: minToTime(startMin), end: minToTime(startMin + mins) })
        }}
      >
        ■ Stop & log
      </Button>
      <Button
        size="sm"
        variant="ghost"
        aria-label="Discard timer"
        onClick={() => {
          localStorage.removeItem('pct.timer')
          setStart(null)
        }}
      >
        Discard
      </Button>
    </div>
  )
}

export function Layout() {
  const { user, data, sum } = useStore()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Partial<Session> | null>(null)
  const [theme, setTheme] = useTheme()
  const toast = useToast()
  const loc = useLocation()
  useEffect(() => setOpen(false), [loc.pathname])
  const onFire = useCallback((r: { label: string }) => toast(`Reminder: ${r.label}`), [toast])
  useReminders(data.settings, onFire)
  const dark = document.documentElement.dataset.theme === 'dark'

  const nav = (
    <nav className="flex flex-col gap-5 px-3 py-4" onClick={(e) => (e.target as HTMLElement).closest('a') && setOpen(false)}>
      {NAV.map((g) => (
        <div key={g.group || 'x'}>
          {g.group && <div className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-ink-3">{g.group}</div>}
          {g.items.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.to === '/'}
              className={({ isActive }) => cx('flex min-h-9 items-center justify-between rounded-lg px-3 text-sm', isActive ? 'bg-accent-soft font-medium text-accent' : 'text-ink-2 hover:bg-surface-2')}
            >
              {i.label}
              {i.to === '/backlog' && sum.backlog.length > 0 && <span className="tnum rounded-md bg-warn-soft px-1.5 text-xs font-medium text-warn">{sum.backlog.length}</span>}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  )
  const brand = (
    <div className="flex items-center gap-2.5 px-5 py-4">
      <img src="/icon.svg" alt="" className="size-8 rounded-lg" />
      <div className="leading-tight">
        <div className="text-[15px] font-semibold">Parsh CA Tracker</div>
        <div className="text-xs text-ink-3">CA Inter · Sep 2027</div>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col overflow-y-auto border-r border-line bg-surface lg:flex">
        {brand}
        {nav}
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="h-full w-72 max-w-[85vw] overflow-y-auto border-r border-line bg-surface" onClick={(e) => e.stopPropagation()}>
            {brand}
            {nav}
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-bg/90 px-4 py-2.5 backdrop-blur sm:px-6">
          <button aria-label="Open menu" className="grid size-10 place-items-center rounded-lg border border-line bg-surface lg:hidden" onClick={() => setOpen(true)}>
            ☰
          </button>
          <span className="font-semibold lg:hidden">Parsh CA</span>
          <div className="hidden lg:block">
            <SyncChip />
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <StudyTimer onStop={setForm} />
            <Button size="sm" variant="primary" onClick={() => setForm({})}>
              + Log session
            </Button>
            <Button size="sm" variant="ghost" aria-label="Toggle dark mode" onClick={() => setTheme(dark ? 'light' : 'dark')} title={`Theme: ${theme}`}>
              {dark ? '☀' : '☾'}
            </Button>
            <div className="hidden items-center gap-2 sm:flex">
              <span className="text-sm text-ink-2">{user?.name}</span>
              <Button size="sm" variant="ghost" onClick={() => void backend.signOut()}>
                {backend.mode === 'local' ? 'Switch profile' : 'Sign out'}
              </Button>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6">
          <div className="mb-3 lg:hidden">
            <SyncChip />
          </div>
          <Outlet />
        </main>
      </div>
      {form && <SessionForm initial={form} onClose={() => setForm(null)} />}
    </div>
  )
}
