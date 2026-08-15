import { defineConfig } from 'astro/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import node from '@astrojs/node';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  vite: {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  },
  devToolbar: {
      enabled: false
  },
  output: 'server',
  adapter: node({
    mode: 'standalone'
  })
});