import { useState } from 'react'
import { Button, Field } from '../components/ui'
import { backend } from '../lib/backend'

export default function Auth() {
  const local = backend.mode === 'local'
  const profiles = backend.localProfiles?.() ?? []
  const [mode, setMode] = useState<'in' | 'up'>(local || !profiles.length ? (local ? 'up' : 'in') : 'in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<unknown>) => {
    setErr('')
    setMsg('')
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const submit = () =>
    run(async () => {
      if (local) {
        if (!name.trim()) throw new Error('Enter a name for the profile.')
        await backend.signUp('', '', name)
        return
      }
      if (!email.includes('@')) throw new Error('Enter a valid e-mail address.')
      if (password.length < 6) throw new Error('Password must be at least 6 characters.')
      if (mode === 'up') {
        if (!name.trim()) throw new Error('Enter your name.')
        const confirm = await backend.signUp(email.trim(), password, name.trim())
        if (confirm) setMsg('Account created. Open the confirmation link sent to your e-mail, then sign in.')
      } else await backend.signIn(email.trim(), password)
    })

  return (
    <div className="grid min-h-full place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <img src="/icon.svg" alt="" className="size-11 rounded-xl" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Parsh CA Tracker</h1>
            <p className="text-sm text-ink-3">CA Intermediate · September 2027</p>
          </div>
        </div>
        <div className="hard border-2 border-ink bg-surface p-6">
          {local && profiles.length > 0 && (
            <div className="mb-5">
              <p className="mb-2 text-[13px] font-medium text-ink-2">Profiles on this device</p>
              <div className="flex flex-col gap-2">
                {profiles.map((p) => (
                  <Button key={p.id} className="justify-between" onClick={() => run(() => backend.signIn(p.id, ''))}>
                    <span>{p.name}</span>
                    <span className="text-xs text-ink-3">Open</span>
                  </Button>
                ))}
              </div>
              <p className="mt-5 text-[13px] font-medium text-ink-2">Or add another profile</p>
            </div>
          )}
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
          >
            {(local || mode === 'up') && (
              <Field label={local ? 'Profile name' : 'Your name'}>
                <input className="inp" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </Field>
            )}
            {!local && (
              <>
                <Field label="E-mail">
                  <input type="email" className="inp" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </Field>
                <Field label="Password">
                  <input type="password" className="inp" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} />
                </Field>
              </>
            )}
            {err && (
              <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
                {err}
              </p>
            )}
            {msg && <p className="rounded-lg bg-good-soft px-3 py-2 text-sm text-good">{msg}</p>}
            <Button type="submit" variant="primary" className="w-full" disabled={busy}>
              {local ? 'Create profile' : mode === 'up' ? 'Create account' : 'Sign in'}
            </Button>
          </form>
          {!local && (
            <button className="mt-4 w-full text-center text-sm text-accent" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
              {mode === 'in' ? 'New here? Create an account' : 'Already have an account? Sign in'}
            </button>
          )}
        </div>
        {local && <p className="mt-4 text-center text-xs text-ink-3">Local mode: data stays in this browser. Add Supabase keys (see README) for cloud sync and friend comparison across devices.</p>}
      </div>
    </div>
  )
}
