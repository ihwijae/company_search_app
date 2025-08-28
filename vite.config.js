/** @type {import('tailwindcss').Config} */
export default {
  // [수정] Tailwind가 스캔할 파일 경로를 올바른 문법으로 수정합니다.
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}", // <-- 이 부분이 핵심적인 수정 사항입니다.
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
