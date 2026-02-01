import type { DebateSession } from './types'

const STORAGE_KEY = 'debate_ai_sessions_v1'

export function loadSessions(): DebateSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as DebateSession[]
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

export function saveSessions(sessions: DebateSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
}

