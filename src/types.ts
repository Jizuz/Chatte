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

/** 知识库文档状态：1 有效 / 0 已删除（软删除） */
export type KbDocStatus = 0 | 1

/** 知识库文档（权威源 kb_doc 记录） */
export interface KbDoc {
  /** 全局唯一文档 ID（UUID），上传时由服务端生成、永久不变 */
  docId: string
  /** 文档分组代码，如 cardio_health */
  docGroup: string
  title: string
  /** 分块数 */
  chunkCount: number
  status: KbDocStatus
  /** 文档正文（列表接口可能不返回，详情接口返回） */
  content?: string
  gmtCreate: string
  gmtUpdate: string
}

/** 知识库文档分页列表（GET /rag/admin/doc/page 响应） */
export interface KbDocListData {
  success?: boolean
  total: number
  /** 文档记录列表 */
  list: KbDoc[]
}
