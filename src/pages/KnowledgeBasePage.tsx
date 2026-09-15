import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { uploadFile, uploadUrl } from '../api/knowledge'

interface KnowledgeBasePageProps {
  onClose: () => void
}

export function KnowledgeBasePage(_: KnowledgeBasePageProps) {
  const [uploadType, setUploadType] = useState<'file' | 'url'>('file')
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const navigate = useNavigate()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setMessage(null)
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    setMessage(null)
    
    try {
      if (uploadType === 'file' && file) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('sourceType', 'local')
        
        await uploadFile(formData)
        setMessage({ type: 'success', text: '文件上传成功' })
        setFile(null)
      } else if (uploadType === 'url' && url) {
        await uploadUrl(url)
        setMessage({ type: 'success', text: 'URL上传成功' })
        setUrl('')
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : '上传失败，请重试' 
      })
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    navigate('/')
  }

  return (
    <div className="knowledge-base-page">
      <div className="page-header">
        <button className="back-btn" onClick={handleBack}>
          <ArrowLeft size={24} />
        </button>
      </div>
      
      <div className="page-content">
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
              disabled={!file || loading}
            >
              {loading ? '上传中...' : '提交'}
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
              disabled={!url || loading}
            >
              {loading ? '上传中...' : '提交'}
            </button>
          </div>
        )}

        {message && (
          <div className={`message message-${message.type}`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  )
}