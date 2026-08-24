import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Send } from 'lucide-react'
import type { Message, User } from '../types'

interface ChatWindowProps {
  peer: User | null
  messages: Message[]
  currentUserId?: string
  locked: boolean
  sending?: boolean
  loadingHistory?: boolean
  sessionClosed?: boolean
  onSend: (content: string) => void | Promise<void>
}

function formatMessageTime(iso: string) {
  return new Date(iso).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ChatWindow({
  peer,
  messages,
  currentUserId,
  locked,
  sending = false,
  loadingHistory = false,
  sessionClosed = false,
  onSend,
}: ChatWindowProps) {
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputLocked = locked || sending || loadingHistory || sessionClosed

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, peer?.id, sending])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text || inputLocked) return
    setDraft('')
    await onSend(text)
  }

  if (!peer) {
    return (
      <section className="chat-window empty">
        <p>{locked ? '请先登录后开始聊天' : '选择左侧会话开始聊天'}</p>
      </section>
    )
  }

  return (
    <section className="chat-window">
      <div className="chat-toolbar">
        <span className="avatar">{peer.avatar}</span>
        <div>
          <h2>{peer.name}</h2>
          <p className="peer-status">
            {peer.status === 'online' ? '在线' : peer.status === 'away' ? '离开' : '离线'}
          </p>
        </div>
      </div>

      <div className="message-scroller">
        {messages.map((m) => {
          const mine = currentUserId != null && m.senderId === currentUserId
          return (
            <div key={m.id} className={`message ${mine ? 'is-mine' : 'is-theirs'}`}>
              <div className="bubble">
                <p>{m.content}</p>
                <time>{formatMessageTime(m.timestamp)}</time>
              </div>
            </div>
          )
        })}
        {sending ? (
          <div className="message is-theirs">
            <div className="bubble is-typing">
              <p>对方正在回复…</p>
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <form className="composer" onSubmit={handleSubmit}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            locked
              ? '请先登录后再发送消息'
              : loadingHistory
                ? '正在加载历史消息…'
                : sessionClosed
                  ? '此会话已结束，无法发送消息'
                  : sending
                    ? '等待对方回复…'
                    : '输入消息…'
          }
          disabled={inputLocked}
          aria-label="消息内容"
        />
        <button
          type="submit"
          className="btn btn-primary send-btn"
          disabled={inputLocked || !draft.trim()}
          aria-label="发送"
        >
          <Send size={18} />
        </button>
      </form>
    </section>
  )
}
