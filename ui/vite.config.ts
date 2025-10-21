import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: resolve(__dirname, '../src/popup'),
    emptyOutDir: true,
  },
  base: './',
});
