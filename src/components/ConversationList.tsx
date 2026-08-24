import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchSessionList } from '../api/session'
import { app } from '../config'
import type { Session } from '../types'

interface ConversationListProps {
  userId: string | null
  activeId: string | null
  onSelect: (sessionId: string) => void
  onSessionsLoaded?: (sessions: Session[]) => void
  locked: boolean
  refreshToken?: number
}

function formatTime(time: string) {
  if (!time) return ''
  const d = new Date(time.includes('T') ? time : time.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return time

  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()

  if (sameDay) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

function sessionTitle(abstract: string) {
  const text = abstract.trim()
  if (!text) return '新对话'
  return text.length > 24 ? `${text.slice(0, 24)}…` : text
}

function statusLabel(status: string) {
  if (status === 'active') return '进行中'
  if (status === 'closed') return '已结束'
  return status || '未知'
}

export function ConversationList({
  userId,
  activeId,
  onSelect,
  onSessionsLoaded,
  locked,
  refreshToken = 0,
}: ConversationListProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const onSessionsLoadedRef = useRef(onSessionsLoaded)
  onSessionsLoadedRef.current = onSessionsLoaded

  const pageSize = app.sessionListPageSize
  const hasMore = sessions.length < total

  const loadPage = useCallback(
    async (nextPage: number, append: boolean) => {
      if (!userId) return

      if (append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }
      setError('')

      try {
        const data = await fetchSessionList({
          userId,
          page: nextPage,
          pageSize,
        })

        setTotal(data.total)
        setPage(data.page)
        setSessions((prev) => {
          const merged = append ? [...prev, ...data.records] : data.records
          onSessionsLoadedRef.current?.(merged)
          return merged
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载会话失败')
        if (!append) {
          setSessions([])
          setTotal(0)
        }
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [userId, pageSize],
  )

  useEffect(() => {
    if (!userId) {
      setSessions([])
      setTotal(0)
      setPage(1)
      setError('')
      return
    }
    loadPage(1, false)
  }, [userId, refreshToken, loadPage])

  const handleLoadMore = () => {
    if (!hasMore || loadingMore || loading) return
    loadPage(page + 1, true)
  }

  return (
    <aside className={`conversation-list ${locked ? 'is-locked' : ''}`}>
      <div className="panel-title">会话</div>

      {!userId ? (
        <p className="conversation-empty">登录后查看会话</p>
      ) : loading && sessions.length === 0 ? (
        <p className="conversation-empty">加载中…</p>
      ) : error && sessions.length === 0 ? (
        <p className="conversation-empty conversation-error">{error}</p>
      ) : sessions.length === 0 ? (
        <p className="conversation-empty">暂无会话</p>
      ) : (
        <>
          <ul>
            {sessions.map((session) => (
              <li key={session.sessionId}>
                <button
                  type="button"
                  className={`conversation-item ${
                    activeId === session.sessionId ? 'is-active' : ''
                  }`}
                  onClick={() => onSelect(session.sessionId)}
                  disabled={locked}
                >
                  <span className="avatar">
                    {session.abstract.trim().slice(0, 1) || '会'}
                  </span>
                  <span className="conversation-body">
                    <span className="conversation-row">
                      <span className="conversation-name">
                        {sessionTitle(session.abstract)}
                      </span>
                      <time>{formatTime(session.lastActiveTime)}</time>
                    </span>
                    <span className="conversation-row">
                      <span className="conversation-preview">
                        {statusLabel(session.status)}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {hasMore ? (
            <div className="conversation-pagination">
              <button
                type="button"
                className="btn btn-ghost btn-block"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? '加载中…' : '加载更多'}
              </button>
            </div>
          ) : null}
        </>
      )}
    </aside>
  )
}
