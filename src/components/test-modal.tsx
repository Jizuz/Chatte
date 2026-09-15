import { useState } from 'react'

interface KnowledgeBaseModalProps {
  open: boolean
  onClose: () => void
}

export function KnowledgeBaseModal({ open, onClose }: KnowledgeBaseModalProps) {
  const [uploadType, setUploadType] = useState<'file' | 'url'>('file')
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState('')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleSubmit = () => {
    if (uploadType === 'file' && file) {
      console.log('上传文件:', file.name)
    } else if (uploadType === 'url' && url) {
      console.log('上传URL:', url)
    }
    onClose()
  }

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>知识库管理</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="upload-options">
            <label className="radio-option">
              <input
                type="radio"
                value="file"
                checked={uploadType === 'file'}
                onChange={(e) => setUploadType(e.target.value as 'file' | 'url')}
              />
              <span>文件上传</span>
            </label>
            <label className="radio-option">
              <input
                type="radio"
                value="url"
                checked={uploadType === 'url'}
                onChange={(e) => setUploadType(e.target.value as 'file' | 'url')}
              />
              <span>网页链接上传</span>
            </label>
          </div>

          {uploadType === 'file' ? (
            <div className="file-upload">
              <input
                type="file"
                onChange={handleFileChange}
                accept=".txt,.pdf,.doc,.docx,.md"
              />
              {file && (
                <div className="selected-file">
                  已选择: {file.name}
                </div>
              )}
              <button 
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={!file}
              >
                提交
              </button>
            </div>
          ) : (
            <div className="url-upload">
              <input
                type="url"
                placeholder="请输入网页链接"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <button 
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={!url}
              >
                提交
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}