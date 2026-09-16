import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// WebXR e la fotocamera richiedono HTTPS: in dev usiamo un certificato
// self-signed (accettalo una volta sul telefono), in produzione GitHub Pages è già HTTPS.
export default defineConfig(({ command }) => ({
  base: './',
  plugins: command === 'serve' ? [basicSsl()] : [],
  server: {
    host: true,
    port: 5173,
    strictPort: false,
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
}));
