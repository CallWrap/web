import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // 브라우저 입장에선 동일 출처(5173)로만 요청하게 해서 Spring 쪽 CORS 설정 없이도 되게 함
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
