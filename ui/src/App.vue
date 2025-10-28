<template>
  <div class="app-container">
    <div style="margin-bottom: 8px; display: flex; align-items: center; gap: 8px">
      <el-tag type="info" style="max-width: 12rem; overflow: hidden">Host: {{ state.host }}</el-tag>
      <el-tag :type="state.isOnlineHost ? 'danger' : 'success'">{{
        state.isOnlineHost ? '线上' : '非线上'
      }}</el-tag>
      <el-tag>{{ state.isPC ? 'PC' : 'WISE' }}</el-tag>
      <el-switch
        v-model="alwaysLog"
        active-text="自动log"
        style="flex-shrink: 0"
        @change="setAlwaysLog"
      />
    </div>

    <el-form label-width="70px" size="small">
      <el-form-item label="SID">
        <el-select
          v-model="sidValue"
          placeholder="选择或输入SID"
          filterable
          style="width: 100%"
          @change="onSidChange"
        >
          <el-option :value="'0'" label="无sid" />
          <el-option
            v-for="(s, idx) in state.storedSids"
            :key="s"
            :value="String(s)"
            :label="`${s} (${idx})`"
          />
          <el-option :value="'-2'" label="-- 输入sid --" />
          <el-option :value="'-1'" label="== 清空sid ==" />
        </el-select>
      </el-form-item>

      <el-form-item label="Query">
        <el-select
          v-model="wordValue"
          placeholder="选择或输入查询词"
          filterable
          style="width: 100%"
          @change="onWordChange"
        >
          <el-option
            v-for="(w, idx) in state.storedWords"
            :key="w + '_' + idx"
            :value="w"
            :label="decodeURIComponentSafe(w) + ` (${idx})`"
          />
          <el-option :value="'-2'" label="-- 输入word --" />
          <el-option :value="'-1'" label="== 清空word ==" />
        </el-select>
      </el-form-item>

      <el-form-item label="分页">
        <el-space>
          <el-button @click="prevPage">上一页</el-button>
          <el-button type="primary" @click="nextPage">下一页</el-button>
        </el-space>
      </el-form-item>

      <el-form-item label="定位卡片">
        <el-space>
          <el-input v-model="tplID" placeholder="tpl 或 srcid" style="width: 140px" />
          <span>#</span>
          <el-input-number v-model="order" :min="1" :max="50" style="width: 100px" />
          <el-button @click="locate">定位</el-button>
        </el-space>
      </el-form-item>

      <el-form-item label="工具">
        <el-space wrap>
          <el-button plain @click="logCard">log</el-button>
          <el-button v-if="!state.isOnlineHost" type="danger" @click="changeHost" plain
            >切换线上</el-button
          >
          <el-button v-else type="default" disabled plain>已是线上</el-button>
          <el-button type="success" plain @click="scrollToTop">回顶</el-button>
        </el-space>
      </el-form-item>

      <el-form-item label="导入导出">
        <el-space direction="vertical" alignment="stretch" style="width: 100%">
          <el-space>
            <el-button @click="doExport">导出</el-button>
            <el-button type="primary" @click="doImport">导入并刷新</el-button>
            <el-popconfirm title="确认清空本地缓存(sids/words)？" @confirm="clearAll">
              <template #reference>
                <el-button type="warning">清空缓存</el-button>
              </template>
            </el-popconfirm>
          </el-space>
          <el-input
            v-model="ioText"
            :autosize="{ minRows: 3, maxRows: 8 }"
            type="textarea"
            placeholder="导出结果会显示在此，也可将外部JSON粘贴到此处导入"
          />
        </el-space>
      </el-form-item>
    </el-form>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, reactive, ref } from 'vue';
import type { State, ContentCommand, CommandPayloadMap, CommandResponseMap } from './types';

const state = reactive<State>({
  host: '',
  isPC: true,
  ONLINE_HOST: [],
  sid: '',
  word: '',
  curWordKey: 'wd',
  pageNum: '00',
  storedSids: [],
  storedWords: [],
  alwaysLog: false,
  isOnlineHost: false,
});

const sidValue = ref<string>('0');
const wordValue = ref<string>('');
const alwaysLog = ref<boolean>(false);
const tplID = ref<string>('');
const order = ref<number>(1);
const ioText = ref<string>('');

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
  payload?: CommandPayloadMap[K]
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
      if (resp.ok) resolve(resp.data as CommandResponseMap[K]);
      else reject(resp.error);
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
  await callContent('next_page');
}
/** 上一页 */
async function prevPage() {
  await callContent('prev_page');
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

/** 导出本地缓存（sids/words）为 JSON 文本 */
async function doExport() {
  const data = await callContent('export_storage');
  ioText.value = JSON.stringify(data);
}
/** 从输入框导入 JSON，并触发页面刷新 */
async function doImport() {
  if (!ioText.value) return;
  await callContent('import_storage', { data: ioText.value });
  // 导入后清除缓存
  cachedState = null;
}
/** 清空所有本地缓存，并刷新状态 */
async function clearAll() {
  await callContent('clear_storage');
  // 清除缓存并重新获取状态
  cachedState = null;
  await initializeState();
}
/** 设置是否自动 log */
async function setAlwaysLog(val: boolean) {
  await callContent('set_always_log', { val });
  updateCachedState({ alwaysLog: val });
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
  min-width: 360px;
  padding: 9px;
}
</style>
