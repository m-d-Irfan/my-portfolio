import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        resume: './resume.html',
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
