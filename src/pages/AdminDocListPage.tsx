import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Plus,
  RotateCcw,
  Search,
} from 'lucide-react'
import {
  deleteKbDoc,
  fetchKbDocDetail,
  fetchKbDocList,
  KB_DOC_GROUPS,
  kbDocGroupName,
  restoreKbDoc,
  updateKbDoc,
} from '../api/knowledge'
import { UploadDocModal } from '../components/UploadDocModal'
import { app } from '../config'
import type { KbDoc, KbDocStatus } from '../types'

/** 分组徽标配色（按分组代码） */
const GROUP_BADGE_STYLES: Record<string, { background: string; color: string }> = {
  cardio_health: { background: '#fde3e0', color: '#9b3b2e' },
  resp_health: { background: '#dceafd', color: '#2b5aa6' },
  ped_health: { background: '#ffefd6', color: '#9a6316' },
  endo_health: { background: '#e8e2f7', color: '#5b3f9e' },
  women_health: { background: '#fbe2ef', color: '#a03a76' },
  common_living: { background: '#d7efe8', color: '#0a4f44' },
}

const STATUS_OPTIONS: Array<{ value: KbDocStatus | ''; label: string }> = [
  { value: '', label: '全部状态' },
  { value: 1, label: '有效' },
  { value: 0, label: '已删除' },
]

/** UUID 缩略展示：8f3a…c21e */
function shortDocId(docId: string): string {
  if (!docId) return '-'
  if (docId.length <= 12) return docId
  return `${docId.slice(0, 4)}…${docId.slice(-4)}`
}

type Banner = { type: 'success' | 'error'; text: string } | null

interface DocActionTarget {
  doc: KbDoc
  action: 'delete' | 'restore'
}

/**
 * 知识库管理后台：
 * 权威源文档列表页 —— 全部变更的操作入口，页面只写权威源库，
 * 索引变更由 MQ 异步驱动。
 * 支持搜索、分组/状态筛选、分页、
 * 上传、查看、编辑、软删除与恢复。
 */
export function AdminDocListPage() {
  const navigate = useNavigate()

  const [records, setRecords] = useState<KbDoc[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [banner, setBanner] = useState<Banner>(null)

  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [docGroup, setDocGroup] = useState('')
  const [status, setStatus] = useState<KbDocStatus | ''>('')

  const [uploadOpen, setUploadOpen] = useState(false)

  const [viewDoc, setViewDoc] = useState<KbDoc | null>(null)
  const [viewContent, setViewContent] = useState<string | null>(null)
  const [viewLoading, setViewLoading] = useState(false)

  const [editing, setEditing] = useState<KbDoc | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editGroup, setEditGroup] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const [confirmTarget, setConfirmTarget] = useState<DocActionTarget | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  const totalPages = Math.max(1, Math.ceil(total / app.kbDocListPageSize))

  const loadList = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await fetchKbDocList({ page, keyword, docGroup, status })
      setRecords(data.list)
      setTotal(data.total)
    } catch (err) {
      setRecords([])
      setTotal(0)
      setLoadError(err instanceof Error ? err.message : '文档列表请求失败')
    } finally {
      setLoading(false)
    }
  }, [page, keyword, docGroup, status])

  useEffect(() => {
    void loadList()
  }, [loadList])

  /** 提示条自动消失 */
  useEffect(() => {
    if (!banner) return
    const timer = window.setTimeout(() => setBanner(null), 5000)
    return () => window.clearTimeout(timer)
  }, [banner])

  /** 查看详情时异步加载正文 */
  useEffect(() => {
    if (!viewDoc) return
    let cancelled = false
    setViewContent(null)
    setViewLoading(true)
    fetchKbDocDetail(viewDoc.docId)
      .then((detail) => {
        if (!cancelled) setViewContent(detail.content ?? '（无正文内容）')
      })
      .catch(() => {
        if (!cancelled) setViewContent('正文加载失败，请稍后重试')
      })
      .finally(() => {
        if (!cancelled) setViewLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [viewDoc])

  /** 变更筛选条件时重置回第一页 */
  const changeFilter = (apply: () => void) => {
    apply()
    setPage(1)
  }

  const openEdit = (doc: KbDoc) => {
    setEditing(doc)
    setEditTitle(doc.title)
    setEditGroup(doc.docGroup)
    setEditContent(doc.content ?? '')
    fetchKbDocDetail(doc.docId)
      .then((detail) => setEditContent(detail.content ?? ''))
      .catch(() => {
        /* 详情获取失败时保留列表数据，正文留空可重新填写 */
      })
  }

  const handleSaveEdit = async () => {
    if (!editing) return
    if (!editTitle.trim()) {
      setBanner({ type: 'error', text: '文档标题不能为空' })
      return
    }
    if (!editGroup) {
      setBanner({ type: 'error', text: '请选择文档分组' })
      return
    }
    setEditSaving(true)
    try {
      await updateKbDoc({
        docId: editing.docId,
        title: editTitle.trim(),
        docGroup: editGroup,
        content: editContent,
      })
      setBanner({
        type: 'success',
        text: `文档「${editTitle.trim()}」已更新，系统将自动发送 UPDATE 消息刷新双索引`,
      })
      setEditing(null)
      await loadList()
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : '更新失败，请稍后重试',
      })
    } finally {
      setEditSaving(false)
    }
  }

  const handleConfirmAction = async () => {
    if (!confirmTarget) return
    setConfirmBusy(true)
    try {
      if (confirmTarget.action === 'delete') {
        await deleteKbDoc(confirmTarget.doc.docId)
        setBanner({
          type: 'success',
          text: `文档「${confirmTarget.doc.title}」已软删除（status=0），索引将同步移除，可在"已删除"状态下恢复`,
        })
      } else {
        await restoreKbDoc(confirmTarget.doc.docId)
        setBanner({
          type: 'success',
          text: `文档「${confirmTarget.doc.title}」已恢复，系统重发 ADD 消息自动重建索引`,
        })
      }
      setConfirmTarget(null)
      await loadList()
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : '操作失败，请稍后重试',
      })
    } finally {
      setConfirmBusy(false)
    }
  }

  const handleUploaded = (message: string) => {
    setBanner({ type: 'success', text: message })
    if (page === 1) {
      void loadList()
    } else {
      setPage(1)
    }
  }

  return (
    <div className="admin-page">
      <button type="button" className="back-btn admin-back" onClick={() => navigate(-1)}>
        <ArrowLeft size={18} />
      </button>

      <div className="admin-toolbar">
        <div className="admin-search">
          <Search size={15} />
          <input
            type="text"
            placeholder="搜索标题 / 内容（回车搜索）"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                changeFilter(() => setKeyword(keywordInput.trim()))
              }
            }}
          />
        </div>
        <select
          className="admin-select"
          value={docGroup}
          onChange={(e) => changeFilter(() => setDocGroup(e.target.value))}
        >
          <option value="">全部分组</option>
          {KB_DOC_GROUPS.map((group) => (
            <option key={group.code} value={group.code}>
              {group.name}
            </option>
          ))}
        </select>
        <select
          className="admin-select"
          value={status}
          onChange={(e) =>
            changeFilter(() =>
              setStatus(e.target.value === '' ? '' : e.target.value === '0' ? 0 : 1),
            )
          }
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={String(option.value)} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="admin-toolbar-spacer" />
        <button type="button" className="btn btn-primary" onClick={() => setUploadOpen(true)}>
          <Plus size={16} />
          上传文档
        </button>
      </div>

      <div className="admin-card">
        {banner && (
          <div className={`message ${banner.type === 'success' ? 'message-success' : 'message-error'}`}>
            {banner.text}
          </div>
        )}
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>文档 ID</th>
                <th>标题</th>
                <th>分组</th>
                <th>分块数</th>
                <th>状态</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="admin-empty">列表加载中…</td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={7} className="admin-empty">
                    {loadError}
                    <button type="button" className="table-action" onClick={() => void loadList()}>
                      重试
                    </button>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="admin-empty">
                    暂无文档，点击右上角「上传文档」新增
                  </td>
                </tr>
              ) : (
                records.map((doc) => {
                  const badge =
                    GROUP_BADGE_STYLES[doc.docGroup] ?? {
                      background: '#eef1ec',
                      color: 'var(--ink-muted)',
                    }
                  return (
                    <tr key={doc.docId}>
                      <td className="doc-id-cell" title={doc.docId}>
                        {shortDocId(doc.docId)}
                      </td>
                      <td className="doc-title-cell" title={doc.title}>
                        {doc.title}
                      </td>
                      <td>
                        <span className="group-badge" style={badge}>
                          {kbDocGroupName(doc.docGroup)}
                        </span>
                      </td>
                      <td>{doc.chunkCount}</td>
                      <td>
                        {doc.status === 1 ? (
                          <span className="status-badge status-active">有效</span>
                        ) : (
                          <span className="status-badge status-deleted">已删除</span>
                        )}
                      </td>
                      <td className="doc-time-cell">{doc.gmtUpdate || '-'}</td>
                      <td className="doc-action-cell">
                        <button type="button" className="table-action" onClick={() => setViewDoc(doc)}>
                          查看
                        </button>
                        {doc.status === 1 ? (
                          <>
                            <button type="button" className="table-action" onClick={() => openEdit(doc)}>
                              编辑
                            </button>
                            <button
                              type="button"
                              className="table-action danger"
                              onClick={() => setConfirmTarget({ doc, action: 'delete' })}
                            >
                              删除
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="table-action"
                            onClick={() => setConfirmTarget({ doc, action: 'restore' })}
                          >
                            <RotateCcw size={12} />
                            恢复
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="admin-tip">
          操作提示：所有操作仅写入权威源库；上传时通过下拉选择分组，编辑 / 删除后由系统自动判定事件类型并发送
          MQ 消息。检索时 Qdrant 先按 doc_group 过滤再向量查询；删除为软删除，可在「已删除」状态下恢复，恢复后系统重发
          ADD 消息自动重建索引。
        </div>

        <div className="admin-pagination">
          <span>
            共 {total} 条记录 · 第 {Math.min(page, totalPages)}/{totalPages} 页
          </span>
          <div className="admin-pagination-btns">
            <button
              type="button"
              className="admin-page-btn"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="上一页"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className="admin-page-btn"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="下一页"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <UploadDocModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={handleUploaded}
      />

      {viewDoc && (
        <div className="modal-overlay" onClick={() => setViewDoc(null)}>
          <div className="modal-content doc-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>文档详情</h3>
              <button className="modal-close" onClick={() => setViewDoc(null)}>×</button>
            </div>
            <div className="modal-body">
              <dl className="doc-detail-grid">
                <dt>文档 ID</dt>
                <dd title={viewDoc.docId}>{viewDoc.docId}</dd>
                <dt>标题</dt>
                <dd>{viewDoc.title}</dd>
                <dt>分组</dt>
                <dd>
                  {kbDocGroupName(viewDoc.docGroup)}（{viewDoc.docGroup}）
                </dd>
                <dt>分块数</dt>
                <dd>{viewDoc.chunkCount}</dd>
                <dt>状态</dt>
                <dd>{viewDoc.status === 1 ? '有效' : '已删除（软删除）'}</dd>
                <dt>创建时间</dt>
                <dd>{viewDoc.gmtCreate || '-'}</dd>
                <dt>更新时间</dt>
                <dd>{viewDoc.gmtUpdate || '-'}</dd>
              </dl>
              {viewLoading ? (
                <div className="admin-empty">正文加载中…</div>
              ) : (
                <pre className="doc-detail-content">{viewContent ?? '（暂无正文）'}</pre>
              )}
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal-content edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>编辑文档</h3>
              <button className="modal-close" onClick={() => setEditing(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="edit-form">
                <div className="edit-field">
                  <label htmlFor="edit-title">文档标题</label>
                  <input
                    id="edit-title"
                    className="upload-input"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                  />
                </div>
                <div className="edit-field">
                  <label htmlFor="edit-group">文档分组</label>
                  <select
                    id="edit-group"
                    className="upload-select"
                    value={editGroup}
                    onChange={(e) => setEditGroup(e.target.value)}
                  >
                    {KB_DOC_GROUPS.map((group) => (
                      <option key={group.code} value={group.code}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="edit-field">
                  <label htmlFor="edit-content">文档内容</label>
                  <textarea
                    id="edit-content"
                    className="edit-textarea"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                  />
                  <span className="field-hint">
                    保存后服务端重算 content_md5，内容变化将发送 UPDATE 消息
                  </span>
                </div>
                <div className="confirm-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setEditing(null)}
                    disabled={editSaving}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void handleSaveEdit()}
                    disabled={editSaving}
                  >
                    {editSaving ? '保存中…' : '保存修改'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmTarget && (
        <div className="modal-overlay" onClick={() => !confirmBusy && setConfirmTarget(null)}>
          <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{confirmTarget.action === 'delete' ? '删除文档' : '恢复文档'}</h3>
              <button className="modal-close" onClick={() => setConfirmTarget(null)}>×</button>
            </div>
            <div className="modal-body">
              <p className="confirm-text">
                {confirmTarget.action === 'delete'
                  ? `确认删除文档「${confirmTarget.doc.title}」？删除为软删除（status=0），之后可在「已删除」状态下恢复。`
                  : `确认恢复文档「${confirmTarget.doc.title}」？恢复后系统将重发 ADD 消息并自动重建索引。`}
              </p>
              <div className="confirm-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setConfirmTarget(null)}
                  disabled={confirmBusy}
                >
                  取消
                </button>
                <button
                  type="button"
                  className={confirmTarget.action === 'delete' ? 'btn btn-danger' : 'btn btn-primary'}
                  onClick={() => void handleConfirmAction()}
                  disabled={confirmBusy}
                >
                  {confirmBusy
                    ? '处理中…'
                    : confirmTarget.action === 'delete'
                      ? '确认删除'
                      : '确认恢复'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}