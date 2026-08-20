import { defineConfig } from 'vite';
import { posturaApiPlugin } from './server/postura-api';

export default defineConfig({
  plugins: [posturaApiPlugin()],
  server: {
    host: '127.0.0.1',
    port: 3000,
    open: false,
  },
});
