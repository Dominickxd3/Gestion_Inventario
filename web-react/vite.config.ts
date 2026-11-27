import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // En desarrollo, /api se redirige a la API NestJS (API_PROXY permite apuntar a otra, p. ej. la de pruebas).
    proxy: { '/api': process.env.API_PROXY ?? 'http://localhost:3000' },
  },
});
