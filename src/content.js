// 内容脚本 - 注入到网页中运行（在 *.baidu.com 上）
// 将原 Tampermonkey 脚本的核心逻辑迁移为可消息调用的 API

(function () {
  'use strict';

  // 仅在百度域名运行其逻辑
  if (!location.hostname.endsWith('.baidu.com')) return;

  const isPC = document.body?.className?.includes('cos-pc');
  const ONLINE_HOST_WISE = ['m.baidu.com', 'semirror-tpl-m.baidu.com', 'fj-m.baidu.com'];
  const ONLINE_HOST_PC = [
    'www.baidu.com',
    'semirror-tpl-www.baidu.com',
    'se-mirror.baidu.com:8954',
    'fj-www.baidu.com',
  ];
  const ONLINE_HOST = [...ONLINE_HOST_WISE, ...ONLINE_HOST_PC];

  /**
   * 解析当前页面URL信息
   * @returns {Object} URL解析结果对象
   * @returns {URL} returns.urlObj - URL对象
   * @returns {string} returns.search - 查询字符串（不包含?）
   * @returns {Array<Array<string>>} returns.queries - 查询参数键值对数组
   * @returns {string} returns.sid - 会话ID
   * @returns {string} returns.curWordKey - 当前搜索关键词的参数名
   * @returns {string} returns.word - 搜索关键词
   * @returns {string} returns.pageNum - 页码
   */
  function getUrlInfo() {
    const urlObj = new URL(location.href);
    const searchParams = urlObj.searchParams;
    const sid = searchParams.get('sid') || '';
    const word = searchParams.get('word') || searchParams.get('wd') || '';
    const curWordKey = searchParams.has('word') ? 'word' : 'wd';
    const pageNum = searchParams.get('pn') || '';

    // 为了兼容性，仍然返回 queries 数组和 search 字符串
    const search = urlObj.search.substring(1); // 移除 ?
    const queries = search ? search.split('&').map(i => {
      const [key, value] = i.split('=');
      return [key, value || ''];
    }) : [];

    return { urlObj, search, queries, sid, curWordKey, word, pageNum };
  }

  function json(strings) {
    try {
      return JSON.parse(strings);
    } catch (e) {
      return '';
    }
  }

  function logCard() {
    const logArr = [];
    const countMap = new Map();
    const tpls = document.querySelectorAll(
      isPC ? 'div.result, div.result-op' : 'div.result, div.c-result'
    );
    tpls.forEach(tpl => {
      const order = tpl.getAttribute(isPC ? 'id' : 'order');
      const tplName = tpl.getAttribute('tpl');
      const srcId = tpl.getAttribute('new_srcid') || tpl.getAttribute('srcid');
      const count = countMap.get(tplName) || 1;
      logArr.push({ order, tpl: tplName, srcId, count });
      if (tpl.querySelector('div[card-info-dom]')) return;
      tpl.style.position = 'relative';
      const infoDom = document.createElement('div');
      infoDom.style.position = 'absolute';
      infoDom.style.right = '0';
      infoDom.style.top = '0';
      infoDom.style.fontSize = '10px';
      infoDom.style.fontFamily = 'monospace';
      infoDom.innerText = order + '-' + tplName + '-' + srcId + '#' + count;
      infoDom.setAttribute('card-info-dom', 1);
      tpl.appendChild(infoDom);
      countMap.set(tplName, count + 1);
    });
    console.debug(logArr);
    return logArr;
  }
  /**
   * 修改URL查询参数并跳转
   * @param {string} key - 要修改的查询参数名
   * @param {string} val - 新的参数值
   */
  function changeSearchQuery(key, val) {
    const { urlObj } = getUrlInfo();
    const searchParams = new URLSearchParams(urlObj.search);
    if (key && val) {
      searchParams.set(key, val);
    } else {
      searchParams.delete(key);
    }
    const newUrl = new URL(urlObj);
    newUrl.search = searchParams.toString();
    location.href = newUrl.toString();
  }

  /**
   * 切换主机名并跳转
   * @param {string} [newHost] - 新的主机名，如果为空则使用默认主机
   */
  function changeHost(newHost) {
    const { urlObj } = getUrlInfo();
    const host = newHost || ONLINE_HOST[0];
    const newUrl = new URL(urlObj);
    newUrl.host = host;
    location.href = newUrl.toString();
  }
  /**
   * 跳转到下一页
   */
  function nextPage() {
    const { pageNum } = getUrlInfo();
    if (pageNum === '') return changeSearchQuery('pn', '10');
    const realPageNum = Number.parseInt(pageNum, 10) / 10;
    const nextPageNum = (realPageNum + 1) * 10;
    return changeSearchQuery('pn', String(nextPageNum));
  }
  /**
   * 跳转到上一页
   */
  function prevPage() {
    const { pageNum } = getUrlInfo();
    if (pageNum === '') return;
    const realPageNum = Number.parseInt(pageNum, 10) / 10;
    const prevPageNum = realPageNum === 1 ? '' : (realPageNum - 1) * 10;
    return changeSearchQuery('pn', String(prevPageNum));
  }

  // ========== Storage helpers (use extension storage, env-aware) ==========

  const storage = (chrome && chrome.storage && chrome.storage.local) || null;
  const isOnlineEnv = ONLINE_HOST.includes(location.host);
  const envKey = key => `${key}_${isOnlineEnv ? 'online' : 'dev'}`;

  function storageGet(keys) {
    return new Promise(resolve => {
      if (!storage) {
        // Fallback (should not happen in extension): try window.localStorage
        if (typeof keys === 'string') {
          const v = window.localStorage.getItem(keys);
          resolve({ [keys]: json(v) || v });
        } else {
          const res = {};
          keys.forEach(k => (res[k] = json(window.localStorage.getItem(k))));
          resolve(res);
        }
        return;
      }
      storage.get(keys, res => resolve(res || {}));
    });
  }

  function storageSet(obj) {
    return new Promise(resolve => {
      if (!storage) {
        Object.keys(obj || {}).forEach(k => {
          const v = obj[k];
          try {
            window.localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
          } catch {}
        });
        resolve();
        return;
      }
      storage.set(obj, () => resolve());
    });
  }

  function storageRemove(keys) {
    return new Promise(resolve => {
      if (!storage) {
        (Array.isArray(keys) ? keys : [keys]).forEach(k => window.localStorage.removeItem(k));
        resolve();
        return;
      }
      storage.remove(keys, () => resolve());
    });
  }

  async function getArray(key) {
    const k = envKey(key);
    const obj = await storageGet(k);
    const val = obj[k];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') return json(val) || [];
    return [];
  }

  async function setArray(key, arr) {
    const k = envKey(key);
    await storageSet({ [k]: arr });
  }

  function getAlwaysLog() {
    const obj = localStorage.getItem('alwaysLogCard');
    return obj && Number(obj) === 1;
  }

  function setAlwaysLog(val) {
    localStorage.setItem('alwaysLogCard', String(val ? 1 : 0));
  }

  async function clearStorage(key) {
    if (!key) {
      await storageRemove([envKey('sids'), envKey('words')]);
      return;
    }
    await storageRemove(envKey(key));
  }

  async function exportStorage() {
    const sids = await getArray('sids');
    const words = await getArray('words');
    return { sids, words };
  }

  async function importStorage(res) {
    const data = typeof res === 'string' ? json(res) : res;
    const { sids = [], words = [] } = data || {};
    await setArray('sids', sids);
    await setArray('words', words);
    location.reload();
  }

  async function deleteSids(...sids) {
    const memoArr = await getArray('sids');
    const filtered = memoArr.filter(i => !sids.map(Number).includes(+i));
    await setArray('sids', filtered);
  }

  async function deleteWordsByIndex(...idxList) {
    const memoArr = await getArray('words');
    const newArr = [];
    memoArr.forEach((w, i) => {
      if (!idxList.includes(i)) newArr.push(w);
    });
    await setArray('words', newArr);
  }

  /**
   * 定位并滚动到指定的搜索结果卡片
   * @param {string|number} tplID - 模板ID或模板名称
   * @param {number} [order=1] - 第几个匹配的卡片（从1开始）
   * @returns {Object|null} 滚动位置信息，如果找不到卡片则返回null
   * @returns {number} returns.y - 卡片的Y坐标位置
   */
  function locateCard(tplID, order = 1) {
    if (!tplID) return;
    let cards;
    if (typeof tplID === 'number' || /^\d+$/.test(tplID)) {
      const id = Number(tplID);
      const sq = isPC
        ? `div.result-op[srcid="${id}"], div.result[srcid="${id}"]`
        : `div.result[srcid="${id}"]`;
      cards = document.querySelectorAll(sq);
    } else {
      const sq = isPC
        ? `div.result-op[tpl="${tplID}"], div.result[tpl="${tplID}"]`
        : `div.result[tpl="${tplID}"]`;
      cards = document.querySelectorAll(sq);
    }
    const card = cards[order - 1];
    if (!card) {
      console.log('找不到模板：', tplID);
      return null;
    }
    const padding = isPC ? 120 : 30;
    const cardTop = card.getBoundingClientRect().top + window.scrollY - padding;
    window.scrollTo({ top: cardTop, behavior: 'smooth' });
    logCard();
    return { y: cardTop };
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * 获取当前页面状态信息
   * @returns {Promise<Object>} 页面状态对象
   * @returns {string} returns.host - 当前主机名
   * @returns {boolean} returns.isPC - 是否为PC端
   * @returns {string[]} returns.ONLINE_HOST - 在线主机列表
   * @returns {string} returns.sid - 会话ID
   * @returns {string} returns.word - 搜索关键词
   * @returns {string} returns.curWordKey - 当前搜索关键词的参数名
   * @returns {string} returns.pageNum - 页码
   * @returns {string[]} returns.storedSids - 存储的会话ID列表
   * @returns {string[]} returns.storedWords - 存储的搜索词列表
   * @returns {boolean} returns.alwaysLog - 是否始终显示卡片信息
   * @returns {boolean} returns.isOnlineHost - 是否为在线主机
   */
  async function getState() {
    const { urlObj, sid, curWordKey, word, pageNum } = getUrlInfo();
    let storedSids = await getArray('sids');
    if (sid && !storedSids.includes(sid)) storedSids.push(sid);
    storedSids = storedSids
      .map(s => String(s))
      .sort((a, b) => Number.parseInt(a) - Number.parseInt(b));
    await setArray('sids', storedSids);

    let storedWords = await getArray('words');
    if (word && !storedWords.includes(word)) storedWords.push(word);
    await setArray('words', storedWords);

    const alwaysLog = getAlwaysLog();
    return {
      host: urlObj.host,
      isPC,
      ONLINE_HOST,
      sid,
      word,
      curWordKey,
      pageNum,
      storedSids,
      storedWords,
      alwaysLog,
      isOnlineHost: ONLINE_HOST.includes(urlObj.host),
    };
  }

  // 缓存当前页面状态
  let cachedState = null;
  let lastUrl = location.href;

  // 检查URL是否发生变化
  function checkUrlChange() {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      return true;
    }
    return false;
  }

  // 获取状态（带缓存）
  async function getCachedState() {
    const urlChanged = checkUrlChange();
    if (!cachedState || urlChanged) {
      cachedState = await getState();
    }
    return cachedState;
  }

  // 更新缓存状态
  function updateCachedState(newState) {
    cachedState = { ...cachedState, ...newState };
  }

  // 暴露 API 给 popup：通过消息通信
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    (async () => {
      try {
        const { cmd, payload } = msg || {};
        switch (cmd) {
          case 'get_state':
            return sendResponse({ ok: true, data: await getCachedState() });
          case 'change_search_query':
            changeSearchQuery(payload?.key, payload?.val);
            // 更新缓存中的相关状态
            if (payload?.key === 'sid') {
              updateCachedState({ sid: payload.val });
            } else if (payload?.key === 'wd' || payload?.key === 'word') {
              updateCachedState({ word: payload.val, curWordKey: payload.key });
            }
            return sendResponse({ ok: true });
          case 'change_host':
            changeHost(payload?.host);
            return sendResponse({ ok: true });
          case 'next_page':
            nextPage();
            return sendResponse({ ok: true });
          case 'prev_page':
            prevPage();
            return sendResponse({ ok: true });
          case 'clear_storage':
            await clearStorage(payload?.key);
            // 清除缓存
            cachedState = null;
            return sendResponse({ ok: true });
          case 'export_storage':
            return sendResponse({ ok: true, data: await exportStorage() });
          case 'import_storage':
            await importStorage(payload?.data);
            // 清除缓存并重新获取状态
            cachedState = null;
            return sendResponse({ ok: true });
          case 'delete_sids':
            await deleteSids(...(payload?.sids || []));
            // 更新缓存
            if (cachedState) {
              cachedState.storedSids = await getArray('sids');
            }
            return sendResponse({ ok: true });
          case 'delete_words_by_index':
            await deleteWordsByIndex(...(payload?.idxList || []));
            // 更新缓存
            if (cachedState) {
              cachedState.storedWords = await getArray('words');
            }
            return sendResponse({ ok: true });
          case 'log_card':
            return sendResponse({ ok: true, data: logCard() });
          case 'locate_card':
            return sendResponse({
              ok: true,
              data: locateCard(payload?.tplID, payload?.order || 1),
            });
          case 'set_always_log':
            setAlwaysLog(payload?.val);
            // 更新缓存
            if (cachedState) {
              cachedState.alwaysLog = !!payload?.val;
            }
            return sendResponse({ ok: true });
          case 'scroll_to_top':
            scrollToTop();
            return sendResponse({ ok: true });
          default:
            return sendResponse({ ok: false, error: 'unknown_cmd' });
        }
      } catch (e) {
        console.error('content error:', e);
        return sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  });

  // 监听页面变化事件
  function setupPageChangeListeners() {
    // 监听URL变化（单页应用）
    let currentUrl = location.href;
    const observer = new MutationObserver(() => {
      if (location.href !== currentUrl) {
        currentUrl = location.href;
        // URL变化时清除缓存
        cachedState = null;
      }
    });

    observer.observe(document, { subtree: true, childList: true });

    // 监听页面刷新
    window.addEventListener('beforeunload', () => {
      // 页面刷新时清除缓存
      cachedState = null;
    });
  }

  // 页面加载时，必要的自动行为
  try {
    const isOnlineHost = ONLINE_HOST.includes(location.host);
    if (isOnlineHost || getAlwaysLog()) logCard();

    // 设置页面变化监听
    setupPageChangeListeners();

    // 初始化缓存
    getCachedState().catch(console.warn);
  } catch (e) {
    console.warn('init failed:', e);
  }
})();
