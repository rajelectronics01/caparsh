import { createContext, useCallback, useContext, useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'

export const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(' ')
export const pct = (n: number) => `${Math.round(n)}%`
export const num = (v: string | number | undefined, d = 0) => {
  const n = typeof v === 'number' ? v : parseFloat(v ?? '')
  return Number.isFinite(n) ? n : d
}

export function Card({ title, sub, action, children, className, pad = true }: { title?: ReactNode; sub?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cx('hard min-w-0 border-2 border-ink bg-surface', className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-ink">{title}</h2>
            {sub && <p className="mt-0.5 text-[13px] text-ink-3">{sub}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={pad ? 'p-5' : ''}>{children}</div>
    </section>
  )
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'good' | 'warn' | 'bad' }) {
  return (
    <div className="hard min-w-0 border-2 border-ink bg-surface px-4 py-3.5">
      <div className="text-[11.5px] font-bold uppercase tracking-wide text-ink-3">{label}</div>
      <div className={cx('tnum mt-1 text-[22px] font-bold leading-tight break-words', tone === 'good' && 'text-good', tone === 'warn' && 'text-warn', tone === 'bad' && 'text-bad')}>{value}</div>
      {hint && <div className="mt-0.5 text-[12.5px] text-ink-3">{hint}</div>}
    </div>
  )
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'soft'; size?: 'sm' | 'md' }
export function Button({ variant = 'soft', size = 'md', className, ...p }: BtnProps) {
  return (
    <button
      type="button"
      {...p}
      className={cx(
        'press inline-flex shrink-0 items-center justify-center gap-1.5 border-2 border-ink font-bold uppercase tracking-wide disabled:opacity-40',
        size === 'sm' ? 'min-h-8 px-2.5 text-[12px]' : 'min-h-10 px-3.5 text-[13px]',
        variant === 'primary' && 'bg-hi text-hi-ink',
        variant === 'soft' && 'bg-surface text-ink hover:bg-surface-2',
        variant === 'ghost' && 'border-transparent! text-ink-2 shadow-none! hover:bg-surface-2',
        variant === 'danger' && 'bg-bad-soft text-bad',
        className,
      )}
    />
  )
}

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-[11.5px] font-bold uppercase tracking-wide text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  )
}

export function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" className="size-4 accent-(--accent)" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

export function Progress({ value, color, className }: { value: number; color?: string; className?: string }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className={cx('h-3 w-full overflow-hidden border-2 border-ink bg-surface', className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full" style={{ width: `${v}%`, background: color ?? 'var(--hi)' }} />
    </div>
  )
}

export function Ring({ value, size = 132, label, sub }: { value: number; size?: number; label?: string; sub?: string }) {
  const r = (size - 14) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ink)" strokeWidth="10" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tnum text-[26px] font-bold">{label ?? `${v.toFixed(v > 0 && v < 10 ? 1 : 0)}%`}</span>
        {sub && <span className="text-xs text-ink-3">{sub}</span>}
      </div>
    </div>
  )
}

const TONES = {
  neutral: 'bg-surface-2 text-ink',
  good: 'bg-good-soft text-good',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  accent: 'bg-hi text-hi-ink',
}
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: keyof typeof TONES }) {
  return <span className={cx('inline-flex items-center whitespace-nowrap border-2 border-ink px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide', TONES[tone])}>{children}</span>
}
export const statusTone = (s: string): keyof typeof TONES =>
  s === 'Completed' ? 'good' : s === 'Not Started' ? 'neutral' : s === 'In Progress' ? 'accent' : 'warn'

export function Dot({ slot }: { slot: number }) {
  return <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: `var(--s${slot})` }} />
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center border-2 border-dashed border-ink px-6 py-10 text-center">
      <p className="font-medium text-ink">{title}</p>
      {children && <p className="mt-1 max-w-md text-sm text-ink-3">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[28px] font-bold leading-none tracking-tight">{title}</h1>
        {sub && <p className="mt-0.5 text-sm text-ink-3">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={cx('flex max-h-[92dvh] w-full flex-col border-2 border-ink bg-surface sm:shadow-[8px_8px_0_var(--ink)]', wide ? 'sm:max-w-2xl' : 'sm:max-w-lg')}>
        <div className="flex items-center justify-between border-b-2 border-ink bg-hi px-5 py-3 text-hi-ink">
          <h2 className="text-base font-semibold">{title}</h2>
          <button aria-label="Close" onClick={onClose} className="grid size-9 place-items-center border-2 border-ink bg-surface font-bold text-ink">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  )
}

export function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[] }) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto border-2 border-ink bg-surface">
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)} className={cx('min-h-8 whitespace-nowrap px-3 text-[12px] font-bold uppercase tracking-wide', value === o.id ? 'bg-ink text-bg' : 'text-ink-2')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function ConfirmButton({ onConfirm, children, label = 'Delete' }: { onConfirm: () => void; children?: ReactNode; label?: string }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <Button size="sm" variant={armed ? 'danger' : 'ghost'} onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))} aria-label={armed ? `Confirm ${label.toLowerCase()}` : label}>
      {armed ? 'Confirm?' : (children ?? label)}
    </Button>
  )
}

// ---- toast
const ToastCtx = createContext<(msg: string, tone?: 'good' | 'bad') => void>(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; tone: 'good' | 'bad' }[]>([])
  const push = useCallback((msg: string, tone: 'good' | 'bad' = 'good') => {
    const id = Date.now() + Math.random()
    setItems((x) => [...x, { id, msg, tone }])
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3500)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className={cx('hard border-2 border-ink px-4 py-2.5 text-sm font-bold', i.tone === 'bad' ? 'bg-bad-soft text-bad' : 'bg-hi text-hi-ink')}>
            {i.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
