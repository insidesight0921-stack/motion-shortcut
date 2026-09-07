import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// PORT 환경변수가 있으면 그 포트를 쓴다(다른 Vite 프로젝트와 5173 충돌 시 유용).
const port = Number(process.env.PORT) || 5173;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 카메라(getUserMedia)는 localhost 또는 HTTPS에서만 열린다.
    host: 'localhost',
    port,
  },
});
