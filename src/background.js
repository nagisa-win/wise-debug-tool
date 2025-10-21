// 后台脚本 - 扩展的主要逻辑
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});

function getActiveTab(cb) {
  try {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      cb(tabs && tabs[0]);
    });
  } catch (e) {
    console.warn('query tabs failed:', e);
    cb(null);
  }
}

// 监听键盘快捷键命令
chrome.commands?.onCommand.addListener(command => {
  if (command === 'log_card') {
    getActiveTab(tab => {
      if (!tab || tab.id == null) return;
      // 向活动页发送 log_card 指令
      chrome.tabs.sendMessage(tab.id, { cmd: 'log_card' }, () => {
        if (chrome.runtime.lastError) {
          // 在非百度页面或未注入时会报错，忽略即可
          console.debug('log_card sendMessage error:', chrome.runtime.lastError.message);
        }
      });
    });
  }
  // 打开弹窗由 _execute_action / _execute_browser_action 保留命令自动处理
});
