import { useRef, useState } from 'react'
import { FileText, Upload } from 'lucide-react'
import {
  KB_DOC_ALLOWED_EXTENSIONS,
  KB_DOC_GROUPS,
  KB_DOC_MAX_FILE_SIZE,
  uploadFile,
  uploadUrl,
} from '../api/knowledge'

interface UploadDocModalProps {
  open: boolean
  onClose: () => void
  /** 上传成功后回调（用于刷新列表与提示） */
  onUploaded: (message: string) => void
}

function isAllowedFile(file: File): boolean {
  const lower = file.name.toLowerCase()
  return KB_DOC_ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

function formatFileSize(size: number): string {
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)} MB`
  }
  return `${Math.max(1, Math.round(size / 1024))} KB`
}

/**
 * 上传文档弹窗：
 * 文件选择后必选文档分组（六分组下拉），确认后由服务端生成 UUID、
 * 自动分块并发送 ADD 消息；
 * 分组决定后续检索过滤范围。
 */
export function UploadDocModal({ open, onClose, onUploaded }: UploadDocModalProps) {
  const [uploadType, setUploadType] = useState<'file' | 'url'>('file')
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState('')
  const [docGroup, setDocGroup] = useState('')
  const [title, setTitle] = useState('')
  const [dragging, setDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  if (!open) return null

  const takeFile = (next: File | undefined | null) => {
    if (!next) return
    if (!isAllowedFile(next)) {
      setError('仅支持 PDF / Word / TXT / Markdown 文件')
      return
    }
    if (next.size > KB_DOC_MAX_FILE_SIZE) {
      setError('文件大小不能超过 20MB')
      return
    }
    setError(null)
    setFile(next)
  }

  const reset = () => {
    setUploadType('file')
    setFile(null)
    setUrl('')
    setDocGroup('')
    setTitle('')
    setDragging(false)
    setSubmitting(false)
    setError(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async () => {
    if (!docGroup) {
      setError('请选择文档分组（必选，分组决定检索过滤范围）')
      return
    }
    if (uploadType === 'file' && !file) {
      setError('请选择要上传的文件')
      return
    }
    if (uploadType === 'url' && !url.trim()) {
      setError('请输入网页链接')
      return
    }
    const finalTitle =
      title.trim() ||
      (uploadType === 'file' && file ? file.name.replace(/\.[^.]+$/, '') : '')
    if (uploadType === 'url' && !finalTitle) {
      setError('请输入文档标题')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      if (uploadType === 'file' && file) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('docGroup', docGroup)
        formData.append('title', finalTitle)
        formData.append('sourceType', 'local')
        const result = await uploadFile(formData)
        if (result && result.success === false) {
          throw new Error(result.message || '上传失败')
        }
      } else {
        const result = await uploadUrl(url.trim(), {
          docGroup,
          title: finalTitle,
        })
        if (result && result.success === false) {
          throw new Error(result.message || '上传失败')
        }
      }
      onUploaded('上传成功：服务端将生成 UUID、自动分块并发送 ADD 消息')
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  const uploadDisabled =
    submitting ||
    !docGroup ||
    (uploadType === 'file' ? !file : !url.trim())

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content upload-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>上传文档</h3>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="upload-tabs">
            <button
              type="button"
              className={uploadType === 'file' ? 'upload-tab active' : 'upload-tab'}
              onClick={() => {
                setUploadType('file')
                setError(null)
              }}
            >
              文件上传
            </button>
            <button
              type="button"
              className={uploadType === 'url' ? 'upload-tab active' : 'upload-tab'}
              onClick={() => {
                setUploadType('url')
                setError(null)
              }}
            >
              网页链接
            </button>
          </div>

          <div className="upload-section">
            <span className="upload-section-no">1</span>
            <div className="upload-section-body">
              {uploadType === 'file' ? (
                <>
                  <div
                    className={dragging ? 'upload-dropzone dragging' : 'upload-dropzone'}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDragging(true)
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault()
                      setDragging(false)
                      takeFile(e.dataTransfer.files?.[0])
                    }}
                  >
                    <div className="upload-dropzone-main">
                      <Upload size={18} />
                      点击选择或拖拽文件
                    </div>
                    <div className="upload-dropzone-hint">
                      支持 PDF / Word / TXT / Markdown，单文件 ≤ 20MB
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={KB_DOC_ALLOWED_EXTENSIONS.join(',')}
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      takeFile(e.target.files?.[0])
                      e.target.value = ''
                    }}
                  />
                  {file && (
                    <div className="upload-selected">
                      <FileText size={16} />
                      <span className="upload-selected-name">
                        {file.name}（{formatFileSize(file.size)}）
                      </span>
                      <button
                        type="button"
                        className="upload-selected-remove"
                        onClick={() => setFile(null)}
                        aria-label="移除文件"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <input
                  className="upload-input"
                  type="url"
                  placeholder="请输入网页链接"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              )}
            </div>
          </div>

          <div className="upload-section">
            <span className="upload-section-no">2</span>
            <div className="upload-section-body">
              <span className="upload-section-label">选择文档分组（必选）</span>
              <select
                className="upload-select"
                value={docGroup}
                onChange={(e) => setDocGroup(e.target.value)}
              >
                <option value="">请选择分组</option>
                {KB_DOC_GROUPS.map((group) => (
                  <option key={group.code} value={group.code}>
                    {group.name}
                  </option>
                ))}
              </select>
              <span className="field-hint">分组决定检索过滤范围，不可为空</span>
            </div>
          </div>

          <div className="upload-section">
            <span className="upload-section-no">3</span>
            <div className="upload-section-body">
              <span className="upload-section-label">文档标题</span>
              <input
                className="upload-input"
                type="text"
                placeholder="请输入文档标题（自动生成 UUID）"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          </div>

          <div className="upload-section">
            <span className="upload-section-no">4</span>
            <div className="upload-section-body">
              <span className="upload-section-label">自动处理</span>
              <ul className="upload-auto-list">
                <li>服务端生成 UUID 作为 doc_id</li>
                <li>长文档自动分块并计算 content_md5</li>
              </ul>
            </div>
          </div>

          {error && <div className="message message-error">{error}</div>}

          <div className="upload-footer">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleClose}
              disabled={submitting}
            >
              取消
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleSubmit()}
              disabled={uploadDisabled}
            >
              {submitting ? '上传中…' : '确认上传'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}