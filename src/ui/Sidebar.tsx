import type { JSX } from 'react'
import type { DebateSession } from '../types'
import { PlusIcon, TrashIcon } from './Icons'

export default function Sidebar(props: {
  sessions: DebateSession[]
  activeId: string | null
  onNew: () => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}): JSX.Element {
  function shortTitle(title: string) {
    const t = (title || '').trim()
    if (!t) return '未命名话题'
    return t.length > 6 ? `${t.slice(0, 6)}…` : t
  }

  return (
    <aside className="sidebar">
      <div className="sidebarTop">
        <button className="newChatBtn" onClick={props.onNew} type="button">
          <PlusIcon />
          新话题
        </button>
      </div>

      <div className="sidebarList" role="list">
        {props.sessions.length === 0 ? (
          <div className="sidebarEmpty">还没有话题，点“新话题”开始。</div>
        ) : (
          props.sessions.map((s) => {
            const active = s.id === props.activeId
            return (
              <div
                key={s.id}
                className={active ? 'sidebarItem active' : 'sidebarItem'}
                role="listitem"
                tabIndex={0}
                onClick={() => props.onSelect(s.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') props.onSelect(s.id)
                }}
              >
                <button
                  type="button"
                  className="sidebarItemMain"
                  title={s.title}
                >
                  <div className="sidebarItemTitle">{shortTitle(s.title)}</div>
                </button>
                <button
                  type="button"
                  className="deleteBtn"
                  onClick={(e) => {
                    e.stopPropagation()
                    props.onDelete(s.id)
                  }}
                  aria-label="删除"
                  title="删除"
                >
                  <TrashIcon />
                </button>
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}
