<template>
  <div class="manage-params">
    <el-form label-width="90px" size="small">
      <el-form-item label="新的 SID">
        <el-space>
          <el-input v-model="newSid" placeholder="输入新的 SID" style="width: 220px" />
        </el-space>
      </el-form-item>

      <el-form-item>
        <el-button type="primary" @click="setSid">设置SID</el-button>
        <el-popconfirm title="确认清空本地缓存(sids)？" @confirm="clearSids">
          <template #reference>
            <el-button type="warning">清空SID缓存</el-button>
          </template>
        </el-popconfirm>
      </el-form-item>

      <el-form-item label="新的 Query">
        <el-space>
          <el-input v-model="newWord" placeholder="输入新的 Query" style="width: 220px" />
        </el-space>
      </el-form-item>

      <el-form-item>
        <el-button type="primary" @click="setWord">设置Query</el-button>
        <el-popconfirm title="确认清空本地缓存(words)？" @confirm="clearWords">
          <template #reference>
            <el-button type="warning">清空Query缓存</el-button>
          </template>
        </el-popconfirm>
      </el-form-item>

      <el-form-item label="导入导出">
        <el-space direction="vertical" alignment="stretch" style="width: 100%">
          <el-space>
            <el-button @click="doExport">导出</el-button>
            <el-button type="primary" @click="doImport">导入并刷新</el-button>
            <el-popconfirm title="确认清空本地缓存(sids/words)？" @confirm="clearAll">
              <template #reference>
                <el-button type="danger">清空全部</el-button>
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
import { onMounted, ref } from 'vue';
import type { ContentCommand, CommandPayloadMap, CommandResponseMap } from '../types';

const newSid = ref('');
const newWord = ref('');
const curWordKey = ref<string>('wd');
const ioText = ref('');

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

async function refreshCurWordKey() {
  try {
    const s: any = await callContent('get_state');
    curWordKey.value = s?.curWordKey || 'wd';
  } catch {}
}

async function setSid() {
  if (!newSid.value) return;
  await callContent('change_search_query', { key: 'sid', val: newSid.value });
}

async function clearSids() {
  await callContent('clear_storage', { key: 'sids' });
}

async function setWord() {
  if (!newWord.value) return;
  await refreshCurWordKey();
  await callContent('change_search_query', { key: curWordKey.value, val: newWord.value });
}

async function clearWords() {
  await callContent('clear_storage', { key: 'words' });
}

async function doExport() {
  const data = await callContent('export_storage');
  ioText.value = JSON.stringify(data);
}

async function doImport() {
  if (!ioText.value) return;
  await callContent('import_storage', { data: ioText.value });
}

async function clearAll() {
  await callContent('clear_storage');
}

onMounted(() => {
  refreshCurWordKey();
});
</script>

<style lang="less" scoped>
.manage-params {
  padding-top: 8px;
}
</style>
