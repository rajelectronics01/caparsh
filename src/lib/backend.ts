import { uid } from './dates'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Collection, Profile, Rec, Reminder } from './types'

export interface RecKey {
  collection: Collection
  id: string
}

export interface Backend {
  mode: 'local' | 'cloud'
  currentUser(): Promise<Profile | null>
  onAuthChange(cb: () => void): () => void
  signIn(email: string, password: string): Promise<void>
  /** Returns true when the account still needs e-mail confirmation before it can sign in. */
  signUp(email: string, password: string, name: string): Promise<boolean>
  signOut(): Promise<void>
  updateName(uid: string, name: string): Promise<void>
  load(uid: string): Promise<Rec[]>
  upsert(uid: string, recs: Rec[]): Promise<void>
  remove(uid: string, keys: RecKey[]): Promise<void>
  friends(uid: string): Promise<Profile[]>
  linkFriend(uid: string, code: string): Promise<void>
  unlinkFriend(uid: string, friendId: string): Promise<void>
  watch(uids: string[], cb: (uid: string) => void): () => void
  savePush(uid: string, sub: PushSubscriptionJSON, reminders: Reminder[], tz: string): Promise<void>
  removePush(endpoint: string): Promise<void>
  /** Local mode only: profiles available on this device. */
  localProfiles?(): Profile[]
}

// ---------------------------------------------------------------- local
const LS = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem(k)
      return v ? (JSON.parse(v) as T) : d
    } catch {
      return d
    }
  },
  set(k: string, v: unknown) {
    localStorage.setItem(k, JSON.stringify(v)) // throws on quota: callers surface the error
  },
}
const code = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('')
const recKey = (r: RecKey) => `${r.collection}/${r.id}`

class LocalBackend implements Backend {
  mode = 'local' as const
  private listeners = new Set<() => void>()
  private watchers = new Set<{ uids: string[]; cb: (uid: string) => void }>()
  localProfiles() {
    return LS.get<Profile[]>('pct.profiles', [])
  }
  async currentUser() {
    const id = LS.get<string | null>('pct.current', null)
    return this.localProfiles().find((p) => p.id === id) ?? null
  }
  onAuthChange(cb: () => void) {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }
  private emit() {
    this.listeners.forEach((l) => l())
  }
  /** In local mode "email" is the profile id picked on the sign-in screen. */
  async signIn(id: string) {
    if (!this.localProfiles().some((p) => p.id === id)) throw new Error('Profile not found on this device')
    LS.set('pct.current', id)
    this.emit()
  }
  async signUp(_e: string, _p: string, name: string) {
    const p: Profile = { id: uid(), name: name.trim() || 'Me', code: code() }
    LS.set('pct.profiles', [...this.localProfiles(), p])
    LS.set('pct.current', p.id)
    this.emit()
    return false
  }
  async signOut() {
    localStorage.removeItem('pct.current')
    this.emit()
  }
  async updateName(uid: string, name: string) {
    LS.set('pct.profiles', this.localProfiles().map((p) => (p.id === uid ? { ...p, name } : p)))
  }
  private read(uid: string) {
    return LS.get<Record<string, unknown>>(`pct.rec.${uid}`, {})
  }
  async load(uid: string) {
    return Object.entries(this.read(uid)).map(([k, data]) => {
      const i = k.indexOf('/')
      return { collection: k.slice(0, i) as Collection, id: k.slice(i + 1), data }
    })
  }
  async upsert(uid: string, recs: Rec[]) {
    const all = this.read(uid)
    for (const r of recs) all[recKey(r)] = r.data
    LS.set(`pct.rec.${uid}`, all)
    this.notify(uid)
  }
  async remove(uid: string, keys: RecKey[]) {
    const all = this.read(uid)
    for (const k of keys) delete all[recKey(k)]
    LS.set(`pct.rec.${uid}`, all)
    this.notify(uid)
  }
  private notify(uid: string) {
    this.watchers.forEach((w) => w.uids.includes(uid) && w.cb(uid))
  }
  async friends(uid: string) {
    const links = LS.get<[string, string][]>('pct.links', [])
    const ids = links.filter((l) => l.includes(uid)).map((l) => (l[0] === uid ? l[1] : l[0]))
    return this.localProfiles().filter((p) => ids.includes(p.id))
  }
  async linkFriend(uid: string, c: string) {
    const f = this.localProfiles().find((p) => p.code === c.trim().toUpperCase())
    if (!f) throw new Error('No account found with that friend code')
    if (f.id === uid) throw new Error('That is your own code')
    const links = LS.get<[string, string][]>('pct.links', [])
    if (!links.some((l) => l.includes(uid) && l.includes(f.id))) LS.set('pct.links', [...links, [uid, f.id]])
  }
  async unlinkFriend(uid: string, fid: string) {
    LS.set('pct.links', LS.get<[string, string][]>('pct.links', []).filter((l) => !(l.includes(uid) && l.includes(fid))))
  }
  watch(uids: string[], cb: (uid: string) => void) {
    const w = { uids, cb }
    this.watchers.add(w)
    // Other tabs on this device write to the same storage.
    const onStorage = (e: StorageEvent) => {
      const uid = e.key?.startsWith('pct.rec.') ? e.key.slice(8) : null
      if (uid && uids.includes(uid)) cb(uid)
    }
    window.addEventListener('storage', onStorage)
    return () => {
      this.watchers.delete(w)
      window.removeEventListener('storage', onStorage)
    }
  }
  async savePush() {}
  async removePush() {}
}

// ---------------------------------------------------------------- cloud (Supabase)
const PAGE = 1000
const fail = (error: { message: string } | null) => {
  if (error) throw new Error(error.message)
}

class CloudBackend implements Backend {
  mode = 'cloud' as const
  private sb: SupabaseClient
  constructor(sb: SupabaseClient) {
    this.sb = sb
  }
  async currentUser() {
    const { data } = await this.sb.auth.getSession()
    const u = data.session?.user
    if (!u) return null
    const sel = await this.sb.from('profiles').select('id, display_name, friend_code').eq('id', u.id).maybeSingle()
    fail(sel.error)
    let row = sel.data
    if (!row) {
      const name = (u.user_metadata?.name as string) || u.email?.split('@')[0] || 'Me'
      const ins = await this.sb.from('profiles').insert({ id: u.id, display_name: name }).select('id, display_name, friend_code').single()
      fail(ins.error)
      row = ins.data
    }
    return { id: row!.id, name: row!.display_name, code: row!.friend_code, email: u.email }
  }
  onAuthChange(cb: () => void) {
    const { data } = this.sb.auth.onAuthStateChange((ev) => {
      if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT') setTimeout(cb, 0)
    })
    return () => data.subscription.unsubscribe()
  }
  async signIn(email: string, password: string) {
    fail((await this.sb.auth.signInWithPassword({ email, password })).error)
  }
  async signUp(email: string, password: string, name: string) {
    const { data, error } = await this.sb.auth.signUp({ email, password, options: { data: { name } } })
    fail(error)
    return !data.session
  }
  async signOut() {
    fail((await this.sb.auth.signOut()).error)
  }
  async updateName(uid: string, name: string) {
    fail((await this.sb.from('profiles').update({ display_name: name }).eq('id', uid)).error)
  }
  async load(uid: string) {
    const out: Rec[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.sb
        .from('records')
        .select('collection, id, data')
        .eq('user_id', uid)
        .order('collection')
        .order('id')
        .range(from, from + PAGE - 1)
      fail(error)
      out.push(...((data ?? []) as Rec[]))
      if (!data || data.length < PAGE) break
    }
    return out
  }
  async upsert(uid: string, recs: Rec[]) {
    const now = new Date().toISOString()
    for (let i = 0; i < recs.length; i += 500) {
      const rows = recs.slice(i, i + 500).map((r) => ({ user_id: uid, collection: r.collection, id: r.id, data: r.data, updated_at: now }))
      fail((await this.sb.from('records').upsert(rows, { onConflict: 'user_id,collection,id' })).error)
    }
  }
  async remove(uid: string, keys: RecKey[]) {
    const by = new Map<string, string[]>()
    for (const k of keys) by.set(k.collection, [...(by.get(k.collection) ?? []), k.id])
    for (const [collection, ids] of by)
      for (let i = 0; i < ids.length; i += 200)
        fail((await this.sb.from('records').delete().eq('user_id', uid).eq('collection', collection).in('id', ids.slice(i, i + 200))).error)
  }
  async friends(uid: string) {
    const links = await this.sb.from('friend_links').select('friend_id').eq('user_id', uid)
    fail(links.error)
    const ids = (links.data ?? []).map((l) => l.friend_id as string)
    if (!ids.length) return []
    const { data, error } = await this.sb.from('profiles').select('id, display_name, friend_code').in('id', ids)
    fail(error)
    return (data ?? []).map((r) => ({ id: r.id, name: r.display_name, code: r.friend_code }))
  }
  async linkFriend(_uid: string, c: string) {
    fail((await this.sb.rpc('link_friend', { code: c.trim().toUpperCase() })).error)
  }
  async unlinkFriend(_uid: string, fid: string) {
    fail((await this.sb.rpc('unlink_friend', { fid })).error)
  }
  watch(uids: string[], cb: (uid: string) => void) {
    const channels = uids.map((uid) =>
      this.sb
        .channel(`rec-${uid}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: `user_id=eq.${uid}` }, () => cb(uid))
        .subscribe(),
    )
    return () => channels.forEach((c) => void this.sb.removeChannel(c))
  }
  async savePush(uid: string, sub: PushSubscriptionJSON, reminders: Reminder[], tz: string) {
    const row = { endpoint: sub.endpoint, user_id: uid, p256dh: sub.keys?.p256dh, auth: sub.keys?.auth, tz, reminders, updated_at: new Date().toISOString() }
    fail((await this.sb.from('push_subscriptions').upsert(row, { onConflict: 'endpoint' })).error)
  }
  async removePush(endpoint: string) {
    fail((await this.sb.from('push_subscriptions').delete().eq('endpoint', endpoint)).error)
  }
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const backend: Backend = url && key ? new CloudBackend(createClient(url, key)) : new LocalBackend()
export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
