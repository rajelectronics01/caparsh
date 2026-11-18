import { describe, expect, it } from 'vitest'
import { buildAlert, fmtDuration, isAlertable, isFresh, isThrottled, THROTTLE_MIN } from '../../supabase/functions/notify-friends/alert'

const now = new Date('2026-11-18T10:00:00Z')

describe('friend alert message', () => {
  it('names the friend, subject and time, with the nudge', () => {
    const a = buildAlert('Rohan', 'DT', 150)
    expect(a.title).toBe('Rohan just studied')
    expect(a.body).toBe('Rohan did DT for 2h 30m. Tum bhi padho, warna tum gaye!')
  })
  it('falls back when the name is empty', () => {
    expect(buildAlert('  ', 'Law', 40).body).toBe('Your friend did Law for 40m. Tum bhi padho, warna tum gaye!')
  })
  it('formats durations', () => {
    expect([fmtDuration(45), fmtDuration(60), fmtDuration(125)]).toEqual(['45m', '1h', '2h 5m'])
  })
})

describe('when an alert is sent', () => {
  it('only for fresh sessions: yesterday, today or tomorrow', () => {
    expect(isFresh('2026-11-18', now)).toBe(true)
    expect(isFresh('2026-11-17', now)).toBe(true)
    expect(isFresh('2026-11-19', now)).toBe(true)
    expect(isFresh('2026-11-16', now)).toBe(false) // restoring an old backup stays silent
    expect(isFresh('2026-11-21', now)).toBe(false)
    expect(isFresh(undefined, now)).toBe(false)
    expect(isFresh('18/11/2026', now)).toBe(false)
  })
  it('only for a real session with a subject and time', () => {
    expect(isAlertable({ date: '2026-11-18', subjectId: 'dt', durationMin: 60 }, now)).toBe(true)
    expect(isAlertable({ date: '2026-11-18', subjectId: 'dt', durationMin: 0 }, now)).toBe(false)
    expect(isAlertable({ date: '2026-11-18', durationMin: 60 }, now)).toBe(false)
    expect(isAlertable(null, now)).toBe(false)
  })
  it('at most one alert per friend every 15 minutes', () => {
    expect(THROTTLE_MIN).toBe(15)
    expect(isThrottled(null, now)).toBe(false)
    expect(isThrottled('2026-11-18T09:50:00Z', now)).toBe(true) // 10 minutes ago
    expect(isThrottled('2026-11-18T09:44:00Z', now)).toBe(false) // 16 minutes ago
  })
})
