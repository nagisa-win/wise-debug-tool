// 最小化的 Chrome 扩展全局类型声明，避免在 Vue/TS 中找不到 `chrome` 的报错。
// 如果后续需要更完整的类型提示，可在 ui 包安装 `@types/chrome`。
// 例如：在项目根目录执行 `pnpm -C ui add -D @types/chrome`。

declare namespace chrome {
  namespace tabs {
    interface Tab {
      id?: number;
    }
    function query(
      queryInfo: { active?: boolean; currentWindow?: boolean },
      callback: (tabs: Tab[]) => void
    ): void;
    function sendMessage(
      tabId: number,
      message: any,
      responseCallback?: (response: any) => void
    ): void;
  }

  namespace runtime {
    const lastError: { message?: string } | undefined;
  }
}
