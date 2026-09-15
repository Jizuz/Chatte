import { useCallback, useMemo, useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Header } from './components/Header'
import { LoginModal } from './components/LoginModal'
import { ConversationList } from './components/ConversationList'
import { ChatWindow } from './components/ChatWindow'
import { KnowledgeBasePage } from './pages/KnowledgeBasePage'
import { useAuth } from './hooks/useAuth'
import { fetchChatReply } from './api/chat'
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
    // 登录后不自动选中会话，保持activeId为null
    if (isAuthenticated) {
      setActiveId(null)
    } else {
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

  // const isActiveSession = (sessionId: string) => {
  //   const session = sessions.find((s) => s.sessionId === sessionId)
  //   if (session) return session.status === 'active'
  //   return messages.some((m) => m.conversationId === sessionId)
  // }

  const handleLogout = async () => {
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
    
    // 如果是已存在的会话，加载历史消息
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
  ) => {
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
  }

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

    const sessionId = activeId
    const isNewSession = !activeId
    const isHistoricalSession = sessions.some((s) => s.sessionId === sessionId)
    
    if (isNewSession) {
      setActiveId(sessionId)
      // 只有在创建真正的新会话时才记录，历史会话不记录
      // if (!isHistoricalSession) {
      setNewSessionId(sessionId)
      // }
    }

    const peerId = BOT_PEER.id

    appendMessage(sessionId, user.id, content)

    let agentSessionId = sessionId
    try {
      const savedData = await persistMessage(sessionId, 0, content)
      setSessionListRefreshToken((t) => t + 1)

      // 如果是新会话，使用从接口返回的session_id更新newSessionId
      if (isNewSession && !isHistoricalSession && savedData && savedData.session_id) {
        setNewSessionId(savedData.session_id)
      }

      // /chat/agent 需要 message/save 返回的服务端 session_id（新会话时本地 id 为空，后端会 500）
      if (savedData?.session_id) {
        agentSessionId = savedData.session_id
      }
    } catch (error) {
      console.warn('用户消息保存失败:', error)
    }

    setSending(true)

    try {
      const { reply, need_emergency, active_agent } = await fetchChatReply(content, agentSessionId)
      // 接口附加信息：是否需要紧急介入、当前生效的智能体
      if (need_emergency || active_agent) {
        console.info('[chat] need_emergency:', need_emergency, 'active_agent:', active_agent)
      }
      appendMessage(sessionId, peerId, reply)
      try {
        const savedReplyData = await persistMessage(sessionId, 1, reply)
        setSessionListRefreshToken((t) => t + 1)
        
        // 如果是新会话，使用从接口返回的session_id更新newSessionId
        if (isNewSession && !isHistoricalSession && savedReplyData?.session_id) {
          setNewSessionId(savedReplyData.session_id)
        }
      } catch (error) {
        console.warn('AI 消息保存失败:', error)
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '请求聊天接口失败'
      appendMessage(sessionId, peerId, `⚠️ ${message}`)
      try {
        await persistMessage(sessionId, 1, `⚠️ ${message}`)
      } catch (saveError) {
        console.warn('错误消息保存失败:', saveError)
      }
    } finally {
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
          
          <Route path="/knowledge-base" element={<KnowledgeBasePage onClose={() => {}} />} />
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
