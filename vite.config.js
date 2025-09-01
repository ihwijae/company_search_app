import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Electron 패키징 시 file:// 로 로드되므로
// 빌드 산출물의 asset 경로가 절대경로('/')가 아닌 상대경로('./')가 되어야 합니다.
export default defineConfig({
  base: './',
  plugins: [react()],
})
