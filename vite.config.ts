import { defineConfig, loadEnv } from 'vite';
import { posturaApiPlugin } from './server/postura-api';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (env.TAVILY_API_KEY && !process.env.TAVILY_API_KEY) {
    process.env.TAVILY_API_KEY = env.TAVILY_API_KEY;
  }
  if (env.YOUTUBE_API_KEY && !process.env.YOUTUBE_API_KEY) {
    process.env.YOUTUBE_API_KEY = env.YOUTUBE_API_KEY;
  }

  return {
    plugins: [posturaApiPlugin()],
    server: {
      host: '127.0.0.1',
      port: 3000,
      open: false,
    },
  };
});
