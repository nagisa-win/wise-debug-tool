<template>
  <div :class="['app-container', currentTab]">
    <div class="status-bar">
      <el-tag type="info" style="max-width: 15rem; overflow: hidden">{{
        state.host || '不支持的域名'
      }}</el-tag>
      <el-tag :type="state.isOnlineHost ? 'danger' : 'success'">{{
        state.isOnlineHost ? '线上' : '非线上'
      }}</el-tag>
      <el-tag>{{ state.isPC ? 'PC' : 'WISE' }}</el-tag>
    </div>

    <el-radio-group v-model="currentTab" size="small" class="radio-group">
      <el-radio-button label="main">主功能</el-radio-button>
      <el-radio-button label="manage">参数管理</el-radio-button>
      <el-radio-button label="top">热门Query</el-radio-button>
    </el-radio-group>

    <template v-if="currentTab === 'main'">
      <el-form label-width="60px" size="small">
        <el-form-item label="SID">
          <el-select
            v-model="sidValue"
            placeholder="选择或输入SID"
            filterable
            style="width: 100%"
            placement="bottom-start"
            popper-class="popup-select-dropdown"
            @change="onSidChange"
          >
            <el-option :value="'0'" label="无sid" />
            <el-option
              v-for="(s, idx) in state.storedSids"
              :key="s"
              :value="String(s)"
              :label="`${s} (${idx})`"
            />
            <!-- <el-option :value="'-2'" label="-- 输入sid --" />
          <el-option :value="'-1'" label="== 清空sid ==" /> -->
          </el-select>
        </el-form-item>

        <el-form-item label="Query">
          <el-select
            v-model="wordValue"
            placeholder="选择或输入查询词"
            filterable
            style="width: 100%"
            placement="bottom-start"
            popper-class="popup-select-dropdown"
            @change="onWordChange"
          >
            <el-option
              v-for="(w, idx) in state.storedWords"
              :key="w + '_' + idx"
              :value="w"
              :label="decodeURIComponentSafe(w) + ` (${idx})`"
            />
            <!-- <el-option :value="'-2'" label="-- 输入word --" />
          <el-option :value="'-1'" label="== 清空word ==" /> -->
          </el-select>
        </el-form-item>

        <el-form-item label="分页">
          <el-space>
            <el-button @click="prevPage">上一页</el-button>
            <el-tag type="success">{{ pnValue }}</el-tag>
            <el-button type="primary" @click="nextPage">下一页</el-button>
          </el-space>
        </el-form-item>

        <el-form-item label="定位卡片">
          <el-space>
            <el-input v-model="tplID" placeholder="tpl 或 srcid" style="width: 140px" />
            <el-input-number v-model="order" :min="1" :max="50" style="width: 90px" />
            <el-button @click="locate">定位</el-button>
          </el-space>
        </el-form-item>

        <el-form-item label="工具">
          <el-space wrap>
            <el-switch
              v-model="alwaysLog"
              active-text="始终log"
              style="flex-shrink: 0"
              @change="setAlwaysLog"
            />
            <el-button plain @click="logCard">log</el-button>
            <fragment>
              <el-button v-if="!state.isOnlineHost" type="danger" @click="changeHost" plain
                >切换线上</el-button
              >
              <el-button v-else type="default" disabled plain>已是线上</el-button>
            </fragment>
            <el-button type="success" plain @click="scrollToTop">回顶</el-button>
          </el-space>
        </el-form-item>
      </el-form>
    </template>

    <template v-else-if="currentTab === 'manage'">
      <ManageParams />
    </template>

    <template v-else>
      <GetTopQueries />
    </template>
    <div class="footer" @click="jumpToGithub">
      <svg
        height="18"
        width="18"
        aria-hidden="true"
        viewBox="0 0 24 24"
        version="1.1"
        data-view-component="true"
        class="icon"
      >
        <path
          d="M12 1C5.923 1 1 5.923 1 12c0 4.867 3.149 8.979 7.521 10.436.55.096.756-.233.756-.522 0-.262-.013-1.128-.013-2.049-2.764.509-3.479-.674-3.699-1.292-.124-.317-.66-1.293-1.127-1.554-.385-.207-.936-.715-.014-.729.866-.014 1.485.797 1.691 1.128.99 1.663 2.571 1.196 3.204.907.096-.715.385-1.196.701-1.471-2.448-.275-5.005-1.224-5.005-5.432 0-1.196.426-2.186 1.128-2.956-.111-.275-.496-1.402.11-2.915 0 0 .921-.288 3.024 1.128a10.193 10.193 0 0 1 2.75-.371c.936 0 1.871.123 2.75.371 2.104-1.43 3.025-1.128 3.025-1.128.605 1.513.221 2.64.111 2.915.701.77 1.127 1.747 1.127 2.956 0 4.222-2.571 5.157-5.019 5.432.399.344.743 1.004.743 2.035 0 1.471-.014 2.654-.014 3.025 0 .289.206.632.756.522C19.851 20.979 23 16.854 23 12c0-6.077-4.922-11-11-11Z"
        ></path>
      </svg>
      <span>Github</span>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, reactive, ref, watch } from 'vue';
import type { State, ContentCommand, CommandPayloadMap, CommandResponseMap } from './types';
import ManageParams from './pages/ManageParams.vue';
import GetTopQueries from './pages/GetTopQueries.vue';

const state = reactive<State>({
  host: '',
  isPC: true,
  ONLINE_HOST: [],
  sid: '',
  word: '',
  curWordKey: 'wd',
  pageNum: '',
  storedSids: [],
  storedWords: [],
  alwaysLog: false,
  isOnlineHost: false,
});

const sidValue = ref<string>('0');
const wordValue = ref<string>('');
const pnValue = ref<number>(0);
const alwaysLog = ref<boolean>(false);
const tplID = ref<string>('');
const order = ref<number>(1);
const currentTab = ref<'main' | 'manage' | 'top'>('main');

watch(currentTab, (val, oldVal) => {
  if (val !== oldVal && val === 'main') {
    // 切回主功能页时刷新状态
    initializeState().catch(console.warn);
  }
});

// 缓存上次获取的状态，避免每次打开popup都重新获取
let cachedState: State | null = null;
let lastTabId: number | null = null;

/**
 * 安全地对字符串进行解码：
 * - 正常情况下返回 decodeURIComponent 结果；
 * - 发生异常（如格式非法）时，直接返回原始字符串，避免阻断渲染。
 */
function decodeURIComponentSafe(v: string) {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

/**
 * 查询当前窗口中处于活动状态的标签页 ID。
 * 由于 `chrome.tabs.query` 为回调风格，这里封装为 Promise 以便在 `async/await` 中使用。
 */
async function getActiveTabId(): Promise<number> {
  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        const tab = tabs[0];
        if (tab && tab.id != null) resolve(tab.id);
        else reject('no_active_tab');
      });
    } catch (e) {
      reject(e);
    }
  });
}

async function callContent<K extends ContentCommand>(
  cmd: K,
  payload?: CommandPayloadMap[K],
  cb?: (response?: CommandResponseMap[K]) => void
): Promise<CommandResponseMap[K]> {
  const tabId = await getActiveTabId();
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { cmd, payload }, resp => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError.message);
        return;
      }
      if (!resp) {
        reject('no_response');
        return;
      }
      if (resp.ok) {
        if (cb) {
          cb(resp.data as CommandResponseMap[K]);
        }
        resolve(resp.data as CommandResponseMap[K]);
      } else reject(resp.error);
    });
  });
}

/**
 * 检查是否需要刷新状态（标签页变化或缓存为空）
 */
async function shouldRefreshState(): Promise<boolean> {
  const currentTabId = await getActiveTabId();
  const tabChanged = lastTabId !== currentTabId;
  lastTabId = currentTabId;

  return !cachedState || tabChanged;
}

/**
 * 获取状态（带缓存）
 */
async function getCachedState(): Promise<State> {
  const needsRefresh = await shouldRefreshState();

  if (needsRefresh || !cachedState) {
    cachedState = await callContent('get_state');
  }

  return cachedState;
}

/**
 * 更新缓存状态
 */
function updateCachedState(newState: Partial<State>) {
  if (cachedState) {
    cachedState = { ...cachedState, ...newState };
  }
}

/**
 * 初始化popup状态（只在需要时刷新）
 */
async function initializeState() {
  try {
    const s = await getCachedState();
    Object.assign(state, s);
    sidValue.value = s.sid ? String(s.sid) : '0';
    wordValue.value = s.word || '';
    alwaysLog.value = !!s.alwaysLog;
    pnValue.value = s.pageNum ? parseInt(s.pageNum, 10) / 10 : 0;
  } catch (error) {
    console.warn('初始化状态失败:', error);
    // 如果获取状态失败，使用默认状态
  }
}

/**
 * 处理 SID 选择变化：支持清空、输入新 SID 或直接切换。
 */
async function onSidChange(val: string) {
  if (val === '0') {
    await callContent('change_search_query', { key: 'sid', val: '' });
    updateCachedState({ sid: '' });
    return;
  }
  if (val === '-1') {
    await callContent('clear_storage', { key: 'sids' });
    // 清除缓存并重新获取状态
    cachedState = null;
    await initializeState();
    return;
  }
  if (val === '-2') {
    const newSid = prompt('输入新的sid：') || '';
    if (!newSid) return;
    await callContent('change_search_query', { key: 'sid', val: newSid });
    updateCachedState({ sid: newSid });
    return;
  }
  await callContent('change_search_query', { key: 'sid', val });
  updateCachedState({ sid: val });
}

/**
 * 处理查询词选择变化：支持清空、输入新查询词或直接切换。
 */
async function onWordChange(val: string) {
  if (val === '-1') {
    await callContent('clear_storage', { key: 'words' });
    // 清除缓存并重新获取状态
    cachedState = null;
    await initializeState();
    return;
  }
  if (val === '-2') {
    const newWord = prompt('输入新的word：') || '';
    if (!newWord) return;
    await callContent('change_search_query', { key: state.curWordKey, val: newWord });
    updateCachedState({ word: newWord });
    return;
  }
  if (val) {
    await callContent('change_search_query', { key: state.curWordKey, val });
    updateCachedState({ word: val });
  }
}
/** 下一页 */
async function nextPage() {
  await callContent('next_page', undefined, () => {
    const newPn = pnValue.value + 1;
    updateCachedState({ pageNum: String(newPn * 10) });
    pnValue.value = newPn;
  });
}
/** 上一页 */
async function prevPage() {
  await callContent('prev_page', undefined, () => {
    const newPn = Math.max(0, pnValue.value - 1);
    updateCachedState({ pageNum: newPn === 0 ? '' : String(newPn * 10) });
    pnValue.value = newPn;
  });
}
/** 切换线上/非线上环境 */
async function changeHost() {
  await callContent('change_host');
  // 切换host后清除缓存
  cachedState = null;
}
/** 在控制台打印卡片信息 */
async function logCard() {
  await callContent('log_card');
}
async function scrollToTop() {
  await callContent('scroll_to_top');
}
/** 根据 tplID + 序号定位卡片 */
async function locate() {
  await callContent('locate_card', { tplID: tplID.value, order: order.value });
}

/** 设置是否自动 log */
async function setAlwaysLog(val: boolean) {
  await callContent('set_always_log', { val });
  updateCachedState({ alwaysLog: val });
}

function jumpToGithub() {
  const url = 'https://github.com/nagisa-win/wise-debug-tool/releases';
  if (typeof chrome !== 'undefined' && chrome?.tabs?.create) {
    chrome.tabs.create({ url });
  } else {
    window.open(url, '_blank');
  }
}

onMounted(() => {
  initializeState().catch(console.warn);
});
</script>

<style lang="less">
html,
body {
  margin: 0;
  padding: 0;
}

.app-container {
  position: relative;
  min-width: 360px;
  padding: 9px;

  &.main {
    min-height: 400px;
  }

  .status-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .radio-group {
    width: 100%;
    margin-bottom: 6px;
    justify-content: center;
  }

  .footer {
    position: absolute;
    bottom: 0;
    padding: 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: monospace;
    font-weight: 500;
    text-decoration: none;
    cursor: pointer;

    &:hover {
      color: #409eff;
    }

    .icon {
      height: 18px;
      width: 18px;
      margin-right: 6px;
    }
  }
}

/* 精简下拉高度，适配弹窗 */
.popup-select-dropdown {
  .el-select-dropdown__wrap {
    max-height: 240px !important;
  }
  .el-select-dropdown__item {
    line-height: 28px;
    height: 28px;
  }
}
</style>
