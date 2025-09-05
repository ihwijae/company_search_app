import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Electron 패키징 시 file:// 로 로드되므로
// 빌드 산출물의 asset 경로가 절대경로('/')가 아닌 상대경로('./')가 되어야 합니다.
export default defineConfig({
  // Electron 패키징 시 file:// 로 index.html을 여므로
  // 빌드 산출물의 asset 경로가 절대('/')가 아닌 상대('./')여야 합니다.
  // dev(server)에는 영향 없음.
  base: './',
  plugins: [react()],
  server: {
    port: 5173,        // 개발 서버 포트를 Electron dev URL과 통일
    strictPort: true,  // 이미 사용 중이면 에러 내고 종료 (다른 포트로 자동 변경 방지)
  },
})
