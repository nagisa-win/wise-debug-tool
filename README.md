# wise-debug-tool

## 百度搜索页面调试工具（Chrome 扩展 / Firefox 扩展）。

> 也支持PC端

### 快速开始

- 前置要求：Node >= 18，建议安装 pnpm 9。
  - 安装 pnpm：`npm i -g pnpm` 或使用 `corepack enable`（Node 自带）
- 安装依赖（工作区）：`pnpm install`
- 一键安装并构建两个目标（Chrome/Firefox）：`pnpm run setup`
- 开发（UI 持续编译 + Webpack 监听）：`pnpm run dev`

### 构建与打包

- 构建 UI 和扩展：`pnpm run build`
- 构建 Chrome 包：`pnpm run build:chrome`，产物位于 `dist/chrome`，同时生成 `dist/chrome.zip`
- 构建 Firefox 包：`pnpm run build:firefox`，产物位于 `dist/firefox`，同时生成 `dist/firefox.zip`

### 项目结构与开发说明

- 本仓库采用 pnpm workspaces（monorepo），`ui/` 为工作区子包，负责扩展弹窗 UI（Vue3 + Element Plus）。
- UI 的 Vite 在开发模式下以“构建监听”方式运行（不启动本地服务），输出目录为 `src/popup/`。
- Webpack 监听会把 `src/popup/` 等资源复制到 `dist/chrome` 与 `dist/firefox`，用于加载未打包的扩展进行调试。
- 受浏览器扩展 CSP 限制，Webpack 在开发环境采用非 eval 的 SourceMap（`cheap-module-source-map`），生产环境关闭 SourceMap，避免 `unsafe-eval` 报错。
- content 脚本（`src/content.js`）与弹窗通过消息通信。弹窗侧已提供类型安全的 `callContent` 封装，见 `ui/src/App.vue`。

### 支持快捷键

- 打开弹窗：Chrome `_execute_action` / Firefox `_execute_browser_action`，默认 `Alt+Shift+P`
- 打印卡片日志：`Alt+Shift+L` 触发 `log_card` 指令，在当前 Baidu 页面打印信息
