export interface User {
  id: string
  name: string
  mobile: string
  avatar?: string
  status?: 'online' | 'away' | 'offline'
}

export interface Message {
  id: string
  conversationId: string | null
  senderId: string
  content: string
  timestamp: string
}

export interface Conversation {
  id: string
  participantIds: string[]
  lastMessageId: string | null
  unread: number
}

export interface Session {
  sessionId: string
  status: string
  createTime: string
  lastActiveTime: string
  closeTime: string | null
  abstract: string
}

export interface SessionListData {
  total: number
  page: number
  pageSize: number
  records: Session[]
}

export interface SessionHistoryMessage {
  userContent: string | null
  agentContent: string | null
  createTime: string
}

export interface SessionHistoryData {
  sessionInfo: {
    sessionId: string
    status: string
    createTime: string
  }
  messageList: SessionHistoryMessage[]
}
