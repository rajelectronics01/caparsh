import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useOutletContext } from 'react-router-dom'
import { backend } from '../lib/backend'
import { minToTime, toISO } from '../lib/dates'
import { useReminders } from '../lib/notify'
import { useStore } from '../lib/store'
import type { Session } from '../lib/types'
import { QuickLog } from './QuickLog'
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

export type Shell = { quickLog: (s?: Partial<Session>) => void }
export const useShell = () => useOutletContext<Shell>()

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
    <span title={sync.error ?? ''} className={cx('inline-flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide', offline ? 'text-bad' : 'text-ink-3')}>
      <span className={cx('size-2.5 border border-ink', offline ? 'bg-bad-soft' : sync.pending ? 'bg-warn-soft' : 'bg-good-soft')} />
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
        ▶ <span className="max-sm:hidden">Start </span>timer
      </Button>
    )
  const sec = Math.floor((Date.now() - start) / 1000)
  const hh = String(Math.floor(sec / 3600)).padStart(2, '0')
  const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0')
  const ss = String(sec % 60).padStart(2, '0')
  return (
    <div className="inline-flex items-center gap-2">
      <span className="tnum border-2 border-ink bg-hi px-2.5 py-1 text-sm font-bold text-hi-ink" aria-label="Elapsed study time">
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
        ■ Stop
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
        ✕
      </Button>
    </div>
  )
}

export function Layout() {
  const { user, data, sum } = useStore()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Partial<Session> | null>(null)
  const [quick, setQuick] = useState<Partial<Session> | null>(null)
  const [theme, setTheme] = useTheme()
  const toast = useToast()
  const loc = useLocation()
  useEffect(() => setOpen(false), [loc.pathname])
  const onFire = useCallback((r: { label: string }) => toast(`Reminder: ${r.label}`), [toast])
  useReminders(data.settings, onFire)
  const dark = document.documentElement.dataset.theme === 'dark'
  const tab = 'flex min-h-16 flex-col items-center justify-center gap-1 text-[10.5px] font-bold uppercase tracking-wide'
  // Each page starts at the top, and the page behind an open menu does not scroll.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [loc.pathname])
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => void (document.body.style.overflow = '')
  }, [open])

  const nav = (
    <nav className="flex flex-col gap-5 px-3 py-4" onClick={(e) => (e.target as HTMLElement).closest('a') && setOpen(false)}>
      {NAV.map((g) => (
        <div key={g.group || 'x'}>
          {g.group && <div className="mb-1 px-3 text-[11px] font-bold uppercase tracking-widest text-ink-3">{g.group}</div>}
          {g.items.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.to === '/'}
              className={({ isActive }) => cx('flex min-h-9 items-center justify-between border-2 px-3 text-sm font-medium', isActive ? 'border-ink bg-hi font-bold text-hi-ink' : 'border-transparent text-ink-2 hover:border-ink')}
            >
              {i.label}
              {i.to === '/backlog' && sum.backlog.length > 0 && <span className="tnum border-2 border-ink bg-warn-soft px-1.5 text-xs font-bold text-warn">{sum.backlog.length}</span>}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  )
  const brand = (
    <div className="flex items-center gap-2.5 px-5 py-4">
      <img src="/icon.svg" alt="" className="size-9 border-2 border-ink" />
      <div className="leading-tight">
        <div className="max-w-40 truncate text-[15px] font-bold uppercase">{user?.name ?? 'CA Tracker'}</div>
        <div className="text-xs text-ink-3">CA Inter tracker · Sep 2027</div>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col overflow-y-auto border-r-2 border-ink bg-surface lg:flex">
        {brand}
        {nav}
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/50 lg:hidden" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Menu" data-menu className="flex max-h-[88dvh] flex-col border-t-2 border-ink bg-bg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b-2 border-ink bg-hi px-4 py-3 text-hi-ink">
              <span className="text-base font-bold uppercase">Menu</span>
              <button aria-label="Close menu" onClick={() => setOpen(false)} className="press grid size-10 place-items-center border-2 border-ink bg-surface font-bold text-ink">
                ✕
              </button>
            </div>
            <div className="overflow-y-auto overscroll-contain px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-4" onClick={(e) => (e.target as HTMLElement).closest('a') && setOpen(false)}>
              {NAV.map((g) => (
                <div key={g.group || 'x'} className="mb-4">
                  {g.group && <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-ink-3">{g.group}</div>}
                  <div className="grid grid-cols-2 gap-2">
                    {g.items.map((i) => (
                      <NavLink key={i.to} to={i.to} end={i.to === '/'} className={({ isActive }) => cx('tile press flex min-h-14 items-center justify-between gap-2 border-2 border-ink px-3 text-[13px] font-bold uppercase leading-tight', isActive && 'on')}>
                        {i.label.replace(' with Friend', '').replace('Daily Study ', 'Study ')}
                        {i.to === '/backlog' && sum.backlog.length > 0 && <span className="tnum border-2 border-ink bg-warn-soft px-1.5 text-xs text-warn">{sum.backlog.length}</span>}
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between gap-2 border-t-2 border-ink pt-4">
                <span className="truncate text-sm font-bold">{user?.name}</span>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setTheme(dark ? 'light' : 'dark')}>
                    {dark ? 'Light mode' : 'Dark mode'}
                  </Button>
                  <Button size="sm" onClick={() => void backend.signOut()}>
                    {backend.mode === 'local' ? 'Switch profile' : 'Sign out'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b-2 border-ink bg-surface px-4 py-2 sm:px-6">
          <NavLink to="/" className="flex min-w-0 items-center gap-2 lg:hidden">
            <img src="/icon.svg" alt="" className="size-8 shrink-0 border-2 border-ink" />
            <span className="truncate text-sm font-bold uppercase">{user?.name ?? 'CA Tracker'}</span>
          </NavLink>
          <div className="hidden lg:block">
            <SyncChip />
          </div>
          <div className="ml-auto flex shrink-0 items-center justify-end gap-2">
            <StudyTimer onStop={setQuick} />
            <Button size="sm" variant="primary" className="max-lg:hidden" onClick={() => setQuick({})}>
              + Log session
            </Button>
            <Button size="sm" variant="ghost" className="max-lg:hidden" aria-label="Toggle dark mode" onClick={() => setTheme(dark ? 'light' : 'dark')} title={`Theme: ${theme}`}>
              {dark ? '☀' : '☾'}
            </Button>
            <div className="hidden items-center gap-2 lg:flex">
              <span className="text-sm text-ink-2">{user?.name}</span>
              <Button size="sm" variant="ghost" onClick={() => void backend.signOut()}>
                {backend.mode === 'local' ? 'Switch profile' : 'Sign out'}
              </Button>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-3 pb-28 pt-4 sm:px-6 sm:pt-6 lg:pb-8">
          <div className="mb-3 lg:hidden">
            <SyncChip />
          </div>
          <Outlet context={{ quickLog: (s) => setQuick(s ?? {}) } satisfies Shell} />
        </main>
      </div>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-[45] grid grid-cols-5 border-t-2 border-ink bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
        {[
          { to: '/', label: 'Home', icon: '⌂' },
          { to: '/log', label: 'Log', icon: '≡' },
        ].map((i) => (
          <NavLink key={i.to} to={i.to} end onClick={() => setOpen(false)} className={({ isActive }) => cx(tab, isActive && !open ? 'bg-[var(--p3)] text-[var(--on-color)]' : 'text-ink')}>
            <span aria-hidden className="text-xl leading-none">{i.icon}</span>
            {i.label}
          </NavLink>
        ))}
        <button aria-label="Log study" onClick={() => (setOpen(false), setQuick({}))} className="grid min-h-16 place-items-center border-x-2 border-ink bg-hi text-4xl font-bold leading-none text-hi-ink active:bg-ink active:text-bg">
          +
        </button>
        <NavLink to="/syllabus" onClick={() => setOpen(false)} className={({ isActive }) => cx(tab, isActive && !open ? 'bg-[var(--p3)] text-[var(--on-color)]' : 'text-ink')}>
          <span aria-hidden className="text-xl leading-none">✓</span>
          Syllabus
        </NavLink>
        <button aria-expanded={open} aria-label={open ? 'Close menu' : 'Menu'} onClick={() => setOpen(!open)} className={cx(tab, open || !['/', '/log', '/syllabus'].includes(loc.pathname) ? 'bg-[var(--p2)] text-[var(--on-color)]' : 'text-ink')}>
          <span aria-hidden className="text-xl leading-none">{open ? '✕' : '☰'}</span>
          Menu
        </button>
      </nav>
      {quick && <QuickLog initial={quick} onClose={() => setQuick(null)} onDetails={(s) => (setQuick(null), setForm(s))} />}
      {form && <SessionForm initial={form} onClose={() => setForm(null)} />}
    </div>
  )
}
