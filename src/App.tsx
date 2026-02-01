import { useEffect, useMemo, useState } from 'react'
import type { DebateSession } from './types'
import { loadSessions, saveSessions } from './storage'
import Sidebar from './ui/Sidebar'
import NewTopicView from './ui/NewTopicView'
import DebateView from './ui/DebateView'

const ACTIVE_KEY = 'debate_ai_active_id_v1'

function sortByUpdatedAtDesc(list: DebateSession[]) {
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt)
}

export default function App() {
  const [sessions, setSessions] = useState<DebateSession[]>(() => sortByUpdatedAtDesc(loadSessions()))
  const [activeId, setActiveId] = useState<string | null>(() => localStorage.getItem(ACTIVE_KEY))

  useEffect(() => {
    if (sessions.length !== 0) return
    const now = Date.now()
    const s: DebateSession = {
      id: crypto.randomUUID(),
      title: '',
      createdAt: now,
      updatedAt: now,
      messages: [],
    }
    setSessions([s])
    setActiveId(s.id)
  }, [sessions.length])

  useEffect(() => {
    saveSessions(sessions)
  }, [sessions])

  useEffect(() => {
    if (activeId) localStorage.setItem(ACTIVE_KEY, activeId)
    else localStorage.removeItem(ACTIVE_KEY)
  }, [activeId])

  useEffect(() => {
    if (activeId && sessions.some((s) => s.id === activeId)) return
    setActiveId(sessions[0]?.id ?? null)
  }, [activeId, sessions])

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeId) ?? null,
    [sessions, activeId],
  )

  function upsertSession(next: DebateSession) {
    setSessions((prev) => sortByUpdatedAtDesc(prev.map((s) => (s.id === next.id ? next : s))))
  }

  function createNewSession() {
    const now = Date.now()
    const s: DebateSession = {
      id: crypto.randomUUID(),
      title: '',
      createdAt: now,
      updatedAt: now,
      messages: [],
    }
    setSessions((prev) => sortByUpdatedAtDesc([s, ...prev]))
    setActiveId(s.id)
  }

  function deleteSession(id: string) {
    const s = sessions.find((x) => x.id === id)
    if (!s) return
    const ok = window.confirm(`删除话题“${s.title || '未命名话题'}”？此操作不可恢复。`)
    if (!ok) return

    setSessions((prev) => prev.filter((x) => x.id !== id))
    if (activeId === id) setActiveId(null)
  }

  return (
    <div className="appShell">
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        onNew={createNewSession}
        onSelect={setActiveId}
        onDelete={deleteSession}
      />

      <main className="main">
        {!activeSession ? (
          <div className="centerPane">
            <div className="topicCard">
              <div className="topicTitle">开始一个新的辩论</div>
              <div className="topicHint">左侧点“新话题”，然后输入辩题。</div>
            </div>
          </div>
        ) : activeSession.title.trim() === '' ? (
          <NewTopicView
            onSubmit={(topic) => {
              upsertSession({
                ...activeSession,
                title: topic,
                updatedAt: Date.now(),
              })
            }}
          />
        ) : (
          <DebateView
            session={activeSession}
            onUpdate={(next) => upsertSession(next)}
          />
        )}
      </main>
    </div>
  )
}
