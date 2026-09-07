import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 카메라(getUserMedia)는 localhost 또는 HTTPS에서만 열린다.
    host: 'localhost',
    port: 5173,
  },
});
