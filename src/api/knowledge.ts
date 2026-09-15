import { api } from '../config'

/** 文件上传接口 */
export async function uploadFile(formData: FormData): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(api.rag.saveFile, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`文件上传失败（${response.status}）`)
    }

    const result = await response.json()
    return result
  } catch (error) {
    console.error('文件上传错误:', error)
    throw error
  }
}

/** 网页链接上传接口 */
export async function uploadUrl(url: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(api.rag.saveUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({ url }),
    })

    if (!response.ok) {
      throw new Error(`URL上传失败（${response.status}）`)
    }

    const result = await response.json()
    return result
  } catch (error) {
    console.error('URL上传错误:', error)
    throw error
  }
}