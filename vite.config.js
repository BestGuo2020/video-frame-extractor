import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// 纯前端工具：所有解码/抽帧/打包都在浏览器内完成，没有任何后端接口。
// 构建产物 dist/ 直接发布到 Cloudflare Pages（public/ 下的 _redirects 会被原样拷贝）。
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5174,
    host: '127.0.0.1',
    watch: {
      // test/ 只放端到端验证用的样例视频与驱动页：体积大、写入时会让 Windows 上的
      // 文件监听抛 EBUSY（编辑器临时文件也会），整体排除，避免开发服务器被拖垮。
      ignored: ['**/test/**'],
    },
  },
  build: {
    target: 'es2020',
    // 单页工具，体积小；保留 sourcemap 便于线上排错
    sourcemap: false,
    rollupOptions: {
      output: {
        // 组件库单独成 chunk，业务代码更新时用户仍可命中缓存
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/(naive-ui|vueuc|seemly|@css-render|lodash-es|date-fns)/.test(id)) return 'naive-ui';
          return 'vendor';
        },
      },
    },
  },
});
