import type { ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { addDays, dow, fmtDate, fmtHM, parseISO, weekStart } from '../lib/dates'
import { Empty } from './ui'

export interface Series {
  key: string
  label: string
  color: string
}
export const CAT_SERIES: Series[] = [
  { key: 'lecture', label: 'Lectures', color: 'var(--s1)' },
  { key: 'self', label: 'Self-study', color: 'var(--s2)' },
  { key: 'practice', label: 'Practice', color: 'var(--s3)' },
  { key: 'revision', label: 'Revision', color: 'var(--s4)' },
]

export function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null
  return (
    <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-2">
      {series.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  )
}

type Row = Record<string, string | number | null>
const axis = { tickLine: false, axisLine: false, tick: { fontSize: 12, fill: 'var(--ink-3)' } } as const

function Tip({ active, payload, label, series, fmtLabel, fmtValue }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string; series: Series[]; fmtLabel?: (l: string) => string; fmtValue: (v: number) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="hard border-2 border-ink bg-surface px-3 py-2 text-[13px]">
      <div className="mb-1 font-medium">{fmtLabel ? fmtLabel(String(label)) : label}</div>
      {payload.map((p) => {
        const s = series.find((x) => x.key === p.dataKey)
        return (
          <div key={p.dataKey} className="flex items-center justify-between gap-4 text-ink-2">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-sm" style={{ background: s?.color }} />
              {s?.label}
            </span>
            <span className="tnum text-ink">{p.value == null ? '–' : fmtValue(p.value)}</span>
          </div>
        )
      })}
    </div>
  )
}

interface ChartProps {
  data: Row[]
  xKey: string
  series: Series[]
  height?: number
  fmtX?: (v: string) => string
  fmtLabel?: (v: string) => string
  fmtValue?: (v: number) => string
  empty?: ReactNode
  yMax?: number
  refY?: number
  refLabel?: string
}
const hasData = (data: Row[], series: Series[]) => data.some((r) => series.some((s) => Number(r[s.key]) > 0))
const hoursFmt = (v: number) => fmtHM(v * 60)

export function Bars({ data, xKey, series: allSeries, height = 240, fmtX, fmtLabel, fmtValue = hoursFmt, empty, stacked, yMax, refY, refLabel }: ChartProps & { stacked?: boolean }) {
  if (!hasData(data, allSeries)) return <>{empty ?? <Empty title="No data yet" />}</>
  // Categories that were never logged (practice, revision) stay out of the legend and bars.
  const series = allSeries.filter((s) => data.some((r) => Number(r[s.key]) > 0))
  return (
    <div>
      <Legend series={series} />
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--ink-3)" strokeDasharray="2 4" />
          <XAxis dataKey={xKey} tickFormatter={fmtX} {...axis} minTickGap={16} />
          <YAxis {...axis} domain={[0, yMax ?? 'auto']} allowDecimals={false} />
          <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={<Tip series={series} fmtLabel={fmtLabel ?? fmtX} fmtValue={fmtValue} />} />
          {refY != null && <ReferenceLine y={refY} stroke="var(--ink-3)" strokeDasharray="4 4" label={{ value: refLabel, position: 'insideTopRight', fontSize: 11, fill: 'var(--ink-3)' }} />}
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} stackId={stacked ? 'a' : undefined} fill={s.color} stroke="var(--ink)" strokeWidth={1.5} maxBarSize={30} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function Lines({ data, xKey, series, height = 240, fmtX, fmtLabel, fmtValue = hoursFmt, empty, yMax }: ChartProps) {
  if (!hasData(data, series)) return <>{empty ?? <Empty title="No data yet" />}</>
  return (
    <div>
      <Legend series={series} />
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--ink-3)" strokeDasharray="2 4" />
          <XAxis dataKey={xKey} tickFormatter={fmtX} {...axis} minTickGap={24} />
          <YAxis {...axis} domain={[0, yMax ?? 'auto']} />
          <Tooltip cursor={{ stroke: 'var(--ink-3)', strokeDasharray: '3 3' }} content={<Tip series={series} fmtLabel={fmtLabel ?? fmtX} fmtValue={fmtValue} />} />
          {series.map((s) => (
            <Line key={s.key} type="linear" dataKey={s.key} stroke={s.color} strokeWidth={3} dot={data.length <= 31 ? { r: 2.5, strokeWidth: 0, fill: s.color } : false} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }} connectNulls isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Labelled horizontal bars: one row per item, value printed at the end. */
export function HBars({ rows, max, fmt, empty }: { rows: { key: string; label: string; value: number; color?: string; value2?: number; color2?: string; note?: string }[]; max?: number; fmt: (v: number) => string; empty?: ReactNode }) {
  const top = max ?? Math.max(...rows.map((r) => Math.max(r.value, r.value2 ?? 0)), 0)
  if (!rows.length || top <= 0) return <>{empty ?? <Empty title="No data yet" />}</>
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.key} className="grid grid-cols-[84px_1fr_auto] items-center gap-3 text-[13px] sm:grid-cols-[110px_1fr_auto]" title={`${r.label}: ${fmt(r.value)}${r.note ? ` · ${r.note}` : ''}`}>
          <span className="truncate text-ink-2">{r.label}</span>
          <div className="space-y-0.5">
            <div className="h-3.5 border-2 border-ink bg-surface">
              <div className="h-full" style={{ width: `${(100 * r.value) / top}%`, minWidth: r.value > 0 ? 4 : 0, background: r.color ?? 'var(--accent)' }} />
            </div>
            {r.value2 != null && (
              <div className="h-3.5 border-2 border-ink bg-surface">
                <div className="h-full" style={{ width: `${(100 * r.value2) / top}%`, minWidth: r.value2 > 0 ? 4 : 0, background: r.color2 }} />
              </div>
            )}
          </div>
          <span className="tnum min-w-12 text-right text-ink">
            {fmt(r.value)}
            {r.value2 != null && <span className="block text-ink-3">{fmt(r.value2)}</span>}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Study consistency calendar: one cell per day, columns are weeks (Mon to Sun). */
export function Heatmap({ minutes, from, to }: { minutes: Map<string, number>; from: string; to: string }) {
  const start = weekStart(from)
  const weeks: string[][] = []
  for (let w = start; w <= to; w = addDays(w, 7)) weeks.push(Array.from({ length: 7 }, (_, i) => addDays(w, i)))
  const level = (m: number) => (m <= 0 ? 0 : m < 120 ? 1 : m < 240 ? 2 : m < 360 ? 3 : 4)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex gap-[3px]">
          <div className="mr-1 mt-[18px] flex flex-col gap-[3px] text-[10px] leading-[13px] text-ink-3">
            {['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].map((d, i) => (
              <span key={i} className="h-[13px]">
                {d}
              </span>
            ))}
          </div>
          {weeks.map((w, wi) => {
            const first = parseISO(w[0])
            const showMonth = wi === 0 || first.getDate() <= 7
            return (
              <div key={w[0]} className="flex flex-col gap-[3px]">
                <span className="h-[15px] text-[10px] text-ink-3">{showMonth ? months[first.getMonth()] : ''}</span>
                {w.map((d) => {
                  const out = d < from || d > to
                  const m = minutes.get(d) ?? 0
                  return <span key={d} title={out ? '' : `${fmtDate(d)}: ${m > 0 ? fmtHM(m) : 'no study logged'}`} className="size-[13px]" style={{ background: out ? 'transparent' : `var(--h${level(m)})`, outline: out ? undefined : '1px solid var(--ink)' }} data-dow={dow(d)} />
                })}
              </div>
            )
          })}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-3">
        <span>0h</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className="size-[13px] rounded-[3px]" style={{ background: `var(--h${l})` }} />
        ))}
        <span>6h+</span>
        <span className="ml-2">Steps: under 2h, 2–4h, 4–6h, 6h+</span>
      </div>
    </div>
  )
}
