import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
      dts: false, // 禁用 auto-imports.d.ts 文件生成
    }),
    Components({
      resolvers: [ElementPlusResolver()],
      dts: false, // 禁用 components.d.ts 文件生成
    }),
  ],
  build: {
    outDir: resolve(__dirname, '../src/popup'),
    emptyOutDir: true,
  },
  base: './',
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
      },
    },
  },
});
