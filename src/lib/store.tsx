import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { chapterStats, completion, subjectStats, summarize, type Summary } from './analytics'
import { backend, type RecKey } from './backend'
import { today } from './dates'
import { defaultSettings, emptyRevisions, seedRecords } from './seed'
import { COLLECTIONS, type Chapter, type Collection, type Data, type Profile, type Rec, type Settings, type Snapshot } from './types'

type Row = { id: string }
const emptyData = (): Data => ({ settings: defaultSettings(), subjects: [], chapters: [], sessions: [], days: [], tests: [], plans: [], snapshots: [] })

export function assemble(recs: Rec[]): Data {
  const d = emptyData()
  for (const r of recs) {
    if (r.collection === 'settings') d.settings = { ...defaultSettings(), ...(r.data as Settings) }
    else if (COLLECTIONS.includes(r.collection)) (d[r.collection] as Row[]).push(r.data as Row)
  }
  d.chapters = d.chapters.map((c) => ({ ...c, lectureMarks: c.lectureMarks ?? [], revisions: c.revisions?.length === 3 ? c.revisions : emptyRevisions() }))
  return d
}
export function disassemble(d: Data): Rec[] {
  const recs: Rec[] = [{ collection: 'settings', id: 'settings', data: d.settings }]
  for (const c of COLLECTIONS) if (c !== 'settings') for (const row of d[c] as Row[]) recs.push({ collection: c, id: row.id, data: row })
  return recs
}

type Op = { key: RecKey; data?: unknown; del?: boolean; v: number }
export type SyncState = { pending: number; error: string | null; saving: boolean }

interface Store {
  mode: 'local' | 'cloud'
  status: 'loading' | 'signedOut' | 'ready' | 'error'
  loadError: string | null
  user: Profile | null
  data: Data
  sum: Summary
  sync: SyncState
  put<C extends Exclude<Collection, 'settings'>>(collection: C, row: Data[C][number]): void
  putMany(recs: Rec[]): void
  del(collection: Collection, id: string): void
  delMany(keys: RecKey[]): void
  setSettings(patch: Partial<Settings>): void
  replaceAll(d: Data): void
  reload(): Promise<void>
  friends: Profile[]
  friendData: Record<string, Data>
  refreshFriends(): Promise<void>
  renameSelf(name: string): Promise<void>
}

const Ctx = createContext<Store | null>(null)
export const useStore = () => {
  const s = useContext(Ctx)
  if (!s) throw new Error('StoreProvider missing')
  return s
}

const outboxKey = (uid: string) => `pct.outbox.${uid}`

export function StoreProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Store['status']>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [user, setUser] = useState<Profile | null>(null)
  const [data, setData] = useState<Data>(emptyData)
  const [sync, setSync] = useState<SyncState>({ pending: 0, error: null, saving: false })
  const [friends, setFriends] = useState<Profile[]>([])
  const [friendData, setFriendData] = useState<Record<string, Data>>({})
  const outbox = useRef(new Map<string, Op>())
  const version = useRef(0)
  const flushing = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const userRef = useRef<Profile | null>(null)
  const loadedAt = useRef(0)

  const persistOutbox = () => {
    const u = userRef.current
    if (!u || backend.mode !== 'cloud') return
    try {
      localStorage.setItem(outboxKey(u.id), JSON.stringify([...outbox.current.values()]))
    } catch {
      /* storage full: the in-memory queue still retries while the tab is open */
    }
  }

  const flush = useCallback(async () => {
    const u = userRef.current
    if (!u || flushing.current || outbox.current.size === 0) return
    flushing.current = true
    setSync((s) => ({ ...s, saving: true }))
    const batch = [...outbox.current.values()]
    try {
      const ups = batch.filter((o) => !o.del).map((o) => ({ ...o.key, data: o.data }))
      const dels = batch.filter((o) => o.del).map((o) => o.key)
      if (ups.length) await backend.upsert(u.id, ups)
      if (dels.length) await backend.remove(u.id, dels)
      for (const o of batch) {
        const k = `${o.key.collection}/${o.key.id}`
        if (outbox.current.get(k)?.v === o.v) outbox.current.delete(k)
      }
      persistOutbox()
      setSync({ pending: outbox.current.size, error: null, saving: false })
      flushing.current = false
      if (outbox.current.size) void flush()
    } catch (e) {
      flushing.current = false
      setSync({ pending: outbox.current.size, error: (e as Error).message, saving: false })
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => void flush(), 8000)
    }
  }, [])

  const enqueue = useCallback(
    (ops: { key: RecKey; data?: unknown; del?: boolean }[]) => {
      for (const o of ops) outbox.current.set(`${o.key.collection}/${o.key.id}`, { ...o, v: ++version.current })
      persistOutbox()
      setSync((s) => ({ ...s, pending: outbox.current.size }))
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => void flush(), backend.mode === 'local' ? 0 : 400)
    },
    [flush],
  )

  const applyRecs = (d: Data, recs: Rec[]): Data => {
    const next = { ...d }
    for (const r of recs) {
      if (r.collection === 'settings') next.settings = r.data as Settings
      else {
        const list = (next[r.collection] as Row[]).slice()
        const i = list.findIndex((x) => x.id === r.id)
        if (i >= 0) list[i] = r.data as Row
        else list.push(r.data as Row)
        ;(next[r.collection] as Row[]) = list
      }
    }
    return next
  }

  const putMany = useCallback(
    (recs: Rec[]) => {
      if (!recs.length) return
      setData((d) => applyRecs(d, recs))
      enqueue(recs.map((r) => ({ key: { collection: r.collection, id: r.id }, data: r.data })))
    },
    [enqueue],
  )
  const delMany = useCallback(
    (keys: RecKey[]) => {
      if (!keys.length) return
      setData((d) => {
        const next = { ...d }
        for (const k of keys) if (k.collection !== 'settings') (next[k.collection] as Row[]) = (next[k.collection] as Row[]).filter((x) => x.id !== k.id)
        return next
      })
      enqueue(keys.map((key) => ({ key, del: true })))
    },
    [enqueue],
  )

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const u = await backend.currentUser()
      userRef.current = u
      setUser(u)
      if (!u) {
        setStatus('signedOut')
        return
      }
      // Writes that never reached the server (offline, closed tab) are replayed on top of what the server has.
      if (backend.mode === 'cloud') {
        try {
          const saved = JSON.parse(localStorage.getItem(outboxKey(u.id)) ?? '[]') as Op[]
          for (const o of saved) outbox.current.set(`${o.key.collection}/${o.key.id}`, { ...o, v: ++version.current })
        } catch {
          /* ignore a corrupt queue */
        }
      }
      let recs = await backend.load(u.id)
      if (!recs.some((r) => r.collection === 'settings')) {
        const seed = seedRecords()
        await backend.upsert(u.id, seed)
        recs = [...recs, ...seed]
      }
      let d = assemble(recs)
      const pend = [...outbox.current.values()]
      d = applyRecs(d, pend.filter((o) => !o.del).map((o) => ({ ...o.key, data: o.data })))
      for (const o of pend.filter((x) => x.del))
        if (o.key.collection !== 'settings') (d[o.key.collection] as Row[]) = (d[o.key.collection] as Row[]).filter((x) => x.id !== o.key.id)
      setData(d)
      loadedAt.current = Date.now()
      setStatus('ready')
      setSync((s) => ({ ...s, pending: outbox.current.size }))
      if (outbox.current.size) void flush()
      backend.friends(u.id).then(setFriends).catch(() => {})
    } catch (e) {
      setLoadError((e as Error).message)
      setStatus('error')
    }
  }, [flush])

  useEffect(() => {
    void load()
    const off = backend.onAuthChange(() => {
      outbox.current.clear()
      setFriendData({})
      setFriends([])
      setStatus('loading')
      void load()
    })
    const onFocus = () => {
      // Pick up edits made on another device, but never while local writes are still queued.
      if (backend.mode === 'cloud' && userRef.current && outbox.current.size === 0 && Date.now() - loadedAt.current > 60000) void load()
    }
    const onOnline = () => void flush()
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onOnline)
    return () => {
      off()
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onOnline)
    }
  }, [load, flush])

  // Warn before closing while writes are unsaved.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (outbox.current.size && backend.mode === 'cloud' && navigator.onLine) e.preventDefault()
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [])

  const sum = useMemo(() => summarize(data, today()), [data])

  // Derived bookkeeping: stamp when a chapter becomes fully prepared, and keep one progress snapshot per day.
  useEffect(() => {
    if (status !== 'ready' || !data.subjects.length) return
    const t = today()
    const recs: Rec[] = []
    for (const c of sum.cs) {
      const done = c.status === 'Completed'
      if (done && !c.chapter.completedAt) recs.push({ collection: 'chapters', id: c.chapter.id, data: { ...c.chapter, completedAt: t } })
      if (!done && c.chapter.completedAt) {
        const { completedAt: _drop, ...rest } = c.chapter
        recs.push({ collection: 'chapters', id: c.chapter.id, data: rest as Chapter })
      }
    }
    const r2 = (n: number) => Math.round(n * 100) / 100
    const snap: Snapshot = {
      id: t,
      overall: r2(sum.comp.overall),
      g1: r2(sum.comp.g1),
      g2: r2(sum.comp.g2),
      revision: r2(sum.comp.revision),
      subjects: Object.fromEntries(sum.ss.map((s) => [s.subject.id, r2(s.completion)])),
    }
    const cur = data.snapshots.find((s) => s.id === t)
    if (!cur || JSON.stringify(cur) !== JSON.stringify(snap)) recs.push({ collection: 'snapshots', id: t, data: snap })
    if (recs.length) putMany(recs)
  }, [sum, status, data.snapshots, data.subjects.length, putMany])

  const refreshFriends = useCallback(async () => {
    const u = userRef.current
    if (!u) return
    const list = await backend.friends(u.id)
    setFriends(list)
    const entries = await Promise.all(list.map(async (f) => [f.id, assemble(await backend.load(f.id))] as const))
    setFriendData(Object.fromEntries(entries))
  }, [])

  // Live comparison: reload a friend's data shortly after they change anything.
  useEffect(() => {
    if (status !== 'ready' || !friends.length) return
    const timers = new Map<string, number>()
    const off = backend.watch(
      friends.map((f) => f.id),
      (uid) => {
        window.clearTimeout(timers.get(uid))
        timers.set(
          uid,
          window.setTimeout(async () => {
            try {
              const d = assemble(await backend.load(uid))
              setFriendData((fd) => ({ ...fd, [uid]: d }))
            } catch {
              /* next change retries */
            }
          }, 1200),
        )
      },
    )
    return () => {
      off()
      timers.forEach((t) => window.clearTimeout(t))
    }
  }, [status, friends])

  const store: Store = {
    mode: backend.mode,
    status,
    loadError,
    user,
    data,
    sum,
    sync,
    put: (collection, row) => putMany([{ collection, id: (row as Row).id, data: row }]),
    putMany,
    del: (collection, id) => delMany([{ collection, id }]),
    delMany,
    setSettings: (patch) => putMany([{ collection: 'settings', id: 'settings', data: { ...data.settings, ...patch } }]),
    replaceAll: (d) => {
      const next = disassemble(d)
      const keep = new Set(next.map((r) => `${r.collection}/${r.id}`))
      delMany(disassemble(data).filter((r) => !keep.has(`${r.collection}/${r.id}`) && r.collection !== 'settings'))
      putMany(next)
    },
    reload: load,
    friends,
    friendData,
    refreshFriends,
    renameSelf: async (name) => {
      if (!user) return
      await backend.updateName(user.id, name)
      setUser({ ...user, name })
    },
  }
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

// Re-exported so pages can derive friend summaries with the same maths as their own.
export { chapterStats, completion, subjectStats, summarize }
