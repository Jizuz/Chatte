import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiBase = env.VITE_API_BASE_URL ?? 'http://118.178.184.46:8000'
  // RAG 知识管理后台独立服务（后端未开 CORS，开发环境经代理规避跨域）
  const ragApiBase = env.VITE_RAG_API_BASE_URL ?? 'http://127.0.0.1:8090'

  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        external: ['node:util', 'node:process', 'node:buffer'],
      },
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    },
    server: {
      proxy: {
        // 开发时若直连遇 CORS，可将 api 地址改为相对路径 /chat、/user
        '/chat': {
          target: apiBase,
          changeOrigin: true,
        },
        '/user': {
          target: apiBase,
          changeOrigin: true,
        },
        '/rag': {
          target: ragApiBase,
          changeOrigin: true,
        },
      },
    },
  }
})
