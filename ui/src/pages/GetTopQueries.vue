<template>
  <div class="get-top-queries">
    <el-form label-width="90px" size="small">
      <el-form-item label="查询地址">
        <el-input v-model="baseUrl" placeholder="输入查询地址" style="width: 250px" />
      </el-form-item>
      <el-form-item label="srcid">
        <el-input v-model="srcid" placeholder="输入 srcid" style="width: 250px" />
      </el-form-item>
      <el-form-item label="模板名">
        <el-input v-model="templateName" placeholder="输入模板名(template)" style="width: 250px" />
      </el-form-item>
      <el-form-item label="个数">
        <el-input v-model="size" placeholder="输入查询个数" type="number" style="width: 250px" />
      </el-form-item>
      <el-form-item>
        <el-space>
          <el-button type="primary" @click="openTopQueryPage">打开URL</el-button>
          <el-button @click="resetFields">清空</el-button>
        </el-space>
      </el-form-item>
    </el-form>
    <div v-if="message" class="message">{{ message }}</div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onBeforeMount } from 'vue';

const HOST_TEST = /https?:\/\/(.+)\.(.+)/;

const baseUrl = ref('');
const srcid = ref('');
const templateName = ref('');
const size = ref(10);
const message = ref('');

function setMessage(msg: string, timeout = 3000) {
  message.value = msg;
  setTimeout(() => {
    message.value = '';
  }, timeout);
}

function buildUrl() {
  if (!baseUrl.value || !HOST_TEST.test(baseUrl.value)) {
    setMessage('请输入查询地址');
    return;
  }
  if (!srcid.value && !templateName.value) {
    setMessage('请输入 srcid 或 模板名');
    return;
  }
  if (isNaN(+size.value) || Number.isInteger(+size.value) || size.value <= 0 || size.value > 100) {
    setMessage('请输入正确的 size');
    return;
  }
  chrome.storage.sync.set({ topQueryBaseUrl: baseUrl.value });
  const params = new URLSearchParams({ size: size.value.toString() });
  if (srcid.value) params.set('srcid', srcid.value);
  if (templateName.value) params.set('template', templateName.value);
  return `${baseUrl.value}?${params.toString()}`;
}

function openTopQueryPage() {
  const url = buildUrl();
  if (!url) return;
  if (typeof chrome !== 'undefined' && chrome?.tabs?.create) {
    chrome.tabs.create({ url });
  } else {
    window.open(url, '_blank');
  }
}

function resetFields() {
  srcid.value = '';
  templateName.value = '';
}

onBeforeMount(() => {
  chrome.storage.sync.get('topQueryBaseUrl').then(data => {
    if (data.topQueryBaseUrl) {
      baseUrl.value = data.topQueryBaseUrl;
    }
  });
});
</script>

<style lang="less" scoped>
.get-top-queries {
  padding-top: 8px;

  .message {
    font-size: 16px;
    font-weight: 500;
    color: red;
  }
}
</style>
