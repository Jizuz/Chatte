import { useCallback, useMemo, useRef, useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Header } from './components/Header'
import { LoginModal } from './components/LoginModal'
import { ConversationList } from './components/ConversationList'
import { ChatWindow } from './components/ChatWindow'
import { AdminDocListPage } from './pages/AdminDocListPage'
import { useAuth } from './hooks/useAuth'
import { streamChatReply } from './api/chat'
import { closeSession, fetchSessionHistory } from './api/session'
import { saveChatMessage } from './api/message'
import { BOT_PEER } from './data/mock'
import type { Message, Session } from './types'
import './App.css'

function App() {
  const { user, isAuthenticated, login, logout } = useAuth()
  const [loginOpen, setLoginOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sessionListRefreshToken, setSessionListRefreshToken] = useState(0)
  const [sessions, setSessions] = useState<Session[]>([])
  const [currentSession, setCurrentSession] = useState<Session | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [newSessionId, setNewSessionId] = useState<string | null>(null)
  /** 正在进行的流式请求控制器，用于退出登录等场景中断 */
  const streamAbortRef = useRef<AbortController | null>(null)
  /** 本次运行期间实时聊过天的会话 id 集合：切回这些会话时直接用本地实时消息，不查数据库 */
  const liveSessionIdsRef = useRef<Set<string>>(new Set())

  const activePeer = isAuthenticated ? BOT_PEER : null

  const activeMessages = useMemo(
    () =>
      messages
        .filter((m) => m.conversationId === activeId)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    [messages, activeId],
  )

  const handleSessionsLoaded = useCallback((loaded: Session[]) => {
    setSessions(loaded)
    // 登录后不自动选中首个会话（activeId 初始为 null）；
    if (!isAuthenticated) {
      setActiveId((current) => current ?? loaded[0]?.sessionId ?? null)
    }

    // 如果有新创建的会话且尚未选中，选中最新创建的会话
    if (newSessionId && !activeId) {
      const newSession = loaded.find(s => s.sessionId === newSessionId)
      if (newSession) {
        setActiveId(newSessionId)
      }
    }
  }, [isAuthenticated, newSessionId, activeId])

  const handleLogout = async () => {
    // 中断进行中的流式回复
    streamAbortRef.current?.abort()

    // 只关闭登录后创建的新会话，不关闭历史会话
    if (user && newSessionId) {
      try {
        await closeSession({ userId: user.id, sessionId: newSessionId })
      } catch (error) {
        console.warn('关闭新会话失败:', error)
      }
    }

    logout()
    setActiveId(null)
    setMessages([])
    setSessions([])
    setSessionListRefreshToken(0)
    setCurrentSession(null)
    setNewSessionId(null)
    liveSessionIdsRef.current.clear()
  }

  const handleSelect = async (sessionId: string) => {
    if (!isAuthenticated) {
      setLoginOpen(true)
      return
    }
    
    setActiveId(sessionId)
    
    // 查找当前会话信息
    const selectedSession = sessions.find((s) => s.sessionId === sessionId)
    setCurrentSession(selectedSession || null)
    
    // 当前实时会话（本次聊过天 / 本次新建）：直接使用本地实时消息，不查数据库
    if (liveSessionIdsRef.current.has(sessionId) || sessionId === newSessionId) {
      return
    }

    // 历史会话：从数据库加载历史消息
    if (selectedSession && user) {
      await loadSessionHistory(user.id, sessionId)
    } else {
      // 新会话（不是历史会话），清空该会话的消息
      setMessages((prev) => prev.filter((m) => m.conversationId !== sessionId))
    }
  }

  const loadSessionHistory = async (userId: string, sessionId: string) => {
    if (!user) return
    
    setLoadingHistory(true)
    try {
      const historyData = await fetchSessionHistory({ userId, sessionId })
      
      // 清空该会话的现有消息
      setMessages((prev) => prev.filter((m) => m.conversationId !== sessionId))
      
      // 将历史消息转换为Message格式
      const historyMessages: Message[] = []
      
      historyData.messageList.forEach((msg, index) => {
        // 用户消息
        if (msg.userContent) {
          const id = `m-history-${sessionId}-user-${index}`
          const userMsg: Message = {
            id,
            conversationId: sessionId,
            senderId: user.id,
            content: msg.userContent,
            timestamp: msg.createTime,
          }
          historyMessages.push(userMsg)
        }
        
        // 代理消息
        if (msg.agentContent) {
          const id = `m-history-${sessionId}-agent-${index}`
          const agentMsg: Message = {
            id,
            conversationId: sessionId,
            senderId: BOT_PEER.id,
            content: msg.agentContent,
            timestamp: msg.createTime,
          }
          historyMessages.push(agentMsg)
        }
      })
      
      // 按时间排序并添加到消息列表
      historyMessages.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      setMessages((prev) => [...prev, ...historyMessages])
      
    } catch (error) {
      console.warn('加载会话历史失败:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  const appendMessage = (
    conversationId: string | null,
    senderId: string,
    content: string,
  ): string => {
    const id = `m-local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const timestamp = new Date().toISOString()
    const next: Message = {
      id,
      conversationId,
      senderId,
      content,
      timestamp,
    }
    setMessages((prev) => [...prev, next])
    return id
  }

  /** 更新已存在消息的内容（用于流式回复增量填充） */
  const updateMessageContent = useCallback((messageId: string, content: string) => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, content } : m)))
  }, [])

  const persistMessage = async (
    sessionId: string | null,
    type: 0 | 1,
    content: string,
  ): Promise<{ session_id: string } | undefined> => {
    if (!user) return undefined
    const savedData = await saveChatMessage({
      userId: user.id,
      sessionId,
      type,
      content,
    })
    return savedData
  }

  const handleSend = async (content: string) => {
    if (!isAuthenticated || sending || !user) return
    
    // 检查当前会话状态，已结束的会话不允许发送消息
    if (currentSession && currentSession.status === 'closed') {
      return
    }

    const isNewSession = !activeId
    // 新会话：生成本地临时会话 id，保证消息有稳定归属；
    const localSessionId = `local-session-${Date.now()}`
    let sessionId = isNewSession ? localSessionId : activeId
    const isHistoricalSession = sessions.some((s) => s.sessionId === sessionId)

    if (isNewSession) {
      setActiveId(localSessionId)
    }

    const peerId = BOT_PEER.id

    // 标记为「实时会话」：之后切回该会话直接展示本地实时消息，不再查数据库
    liveSessionIdsRef.current.add(sessionId)

    appendMessage(sessionId, user.id, content)

    // 服务端会话 id：新会话首轮传 null 由服务端创建，其余传当前会话 id
    let agentSessionId = isNewSession ? null : sessionId
    try {
      const savedData = await persistMessage(agentSessionId, 0, content)
      setSessionListRefreshToken((t) => t + 1)

      // /chat/agent 与后续保存都需要 message/save 返回的服务端 session_id
      if (savedData?.session_id) {
        agentSessionId = savedData.session_id

        // 新会话：把本地临时会话的消息迁移到服务端会话 id，并选中该会话
        if (isNewSession && !isHistoricalSession) {
          const serverSessionId = savedData.session_id
          setMessages((prev) =>
            prev.map((m) => (m.conversationId === localSessionId ? { ...m, conversationId: serverSessionId } : m)),
          )
          setActiveId(serverSessionId)
          setNewSessionId(serverSessionId)
          liveSessionIdsRef.current.add(serverSessionId)
          sessionId = serverSessionId
        }
      }
    } catch (error) {
      console.warn('用户消息保存失败:', error)
    }

    setSending(true)

    // 先创建一条空的机器人消息，随后通过 SSE 增量填充内容
    const botMessageId = appendMessage(sessionId, peerId, '')
    let streamed = ''

    const controller = new AbortController()
    streamAbortRef.current = controller

    try {
      const { reply } = await streamChatReply(content, agentSessionId, user.id, {
        signal: controller.signal,
        onDelta: (delta) => {
          streamed += delta
          updateMessageContent(botMessageId, streamed)
        },
        onMeta: (meta) => {
          // 接口附加信息：是否需要紧急介入、当前生效的智能体
          if (meta.need_emergency || meta.active_agent) {
            console.info('[chat] need_emergency:', meta.need_emergency, 'active_agent:', meta.active_agent)
          }
        },
      })
      // 兜底：后端可能未以 SSE 返回（回退整体解析），确保消息内容被填充
      updateMessageContent(botMessageId, reply)
      try {
        // 使用服务端会话 id 保存，避免新会话首轮在服务端另建会话
        const savedReplyData = await persistMessage(agentSessionId, 1, reply)
        setSessionListRefreshToken((t) => t + 1)

        // 如果是新会话，使用从接口返回的session_id更新newSessionId
        if (isNewSession && !isHistoricalSession && savedReplyData?.session_id) {
          setNewSessionId(savedReplyData.session_id)
        }
      } catch (error) {
        console.warn('AI 消息保存失败:', error)
      }
    } catch (error) {
      // 主动中断（如退出登录）：保留已流出的部分内容，不再标记为错误
      if (error instanceof Error && error.name === 'AbortError') {
        updateMessageContent(botMessageId, streamed || '（回复已取消）')
        return
      }
      const message =
        error instanceof Error ? error.message : '请求聊天接口失败'
      const finalText = streamed ? `${streamed}\n\n⚠️ ${message}` : `⚠️ ${message}`
      updateMessageContent(botMessageId, finalText)
      try {
        await persistMessage(agentSessionId, 1, finalText)
      } catch (saveError) {
        console.warn('错误消息保存失败:', saveError)
      }
    } finally {
      streamAbortRef.current = null
      setSending(false)
      
      // 确保新创建的会话被选中
      if (isNewSession && !isHistoricalSession) {
        // 等待会话列表刷新后选中最新会话
        setTimeout(() => {
          const latestSession = sessions[sessions.length - 1]
          if (latestSession && latestSession.sessionId === sessionId) {
            setActiveId(sessionId)
          }
        }, 100)
      }
    }
  }

  return (
    <Router>
      <div className="app-shell">
        <Header
          user={user}
          onLoginClick={() => setLoginOpen(true)}
          onLogout={handleLogout}
        />

        <Routes>
          <Route path="/" element={
            <main className="app-main">
              {!isAuthenticated ? (
                <div className="guest-banner">
                  你正在以访客浏览。登录后可发送消息。
                  <button type="button" className="link-btn" onClick={() => setLoginOpen(true)}>
                    立即登录
                  </button>
                </div>
              ) : null}

              <div className="workspace">
                <ConversationList
                  userId={user?.id ?? null}
                  activeId={activeId}
                  onSelect={handleSelect}
                  onSessionsLoaded={handleSessionsLoaded}
                  locked={!isAuthenticated}
                  refreshToken={sessionListRefreshToken}
                />
                <ChatWindow
                  peer={activePeer}
                  messages={activeMessages}
                  currentUserId={user?.id}
                  locked={!isAuthenticated}
                  sending={sending}
                  loadingHistory={loadingHistory}
                  sessionClosed={currentSession?.status === 'closed'}
                  onSend={handleSend}
                />
              </div>
            </main>
          } />
          
          <Route path="/knowledge-base" element={<AdminDocListPage />} />
        </Routes>

        <LoginModal
          open={loginOpen}
          onClose={() => setLoginOpen(false)}
          onSubmit={login}
        />
      </div>
    </Router>
  )
}

export default App
