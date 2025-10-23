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

  function getUrlInfo() {
    const urlObj = new URL(location.href);
    let search = urlObj.search;
    if (search.startsWith('?')) search = search.substring(1);
    const queries = search ? search.split('&').map(i => i.split('=')) : [];
    const sid = (queries.find(i => i[0] === 'sid') || [])[1];
    const wordArg = queries.find(i => i[0] === 'word' || i[0] === 'wd') || [];
    const curWordKey = wordArg[0] || 'wd';
    const pageNumArg = queries.find(i => i[0] === 'pn') || [];
    const word = wordArg[1] ? wordArg[1].replace(/%(?![0-9A-Fa-f]{2})/g, '%25') : '';
    const pageNum = pageNumArg[1] || '00';
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
      logArr.push({ order, tpl: tplName, srcId, c: count });
      if (tpl.querySelector('div#card-info-dom')) return;
      tpl.style.position = 'relative';
      const infoDom = document.createElement('div');
      infoDom.style.position = 'absolute';
      infoDom.style.right = '0';
      infoDom.style.top = '0';
      infoDom.style.fontSize = '10px';
      infoDom.style.fontFamily = 'monospace';
      infoDom.innerText = order + '-' + tplName + '-' + srcId + '#' + count;
      infoDom.id = 'card-info-dom';
      tpl.appendChild(infoDom);
      countMap.set(tplName, count + 1);
    });
    console.debug(logArr);
    return logArr;
  }

  function changeSearchQuery(key, val) {
    const { urlObj, search, queries } = getUrlInfo();
    let newSearch = '';
    if (!queries.find(i => i[0] === key)) {
      newSearch = [...queries, [key, val]].map(i => i.join('=')).join('&');
    } else {
      newSearch = queries.map(i => (i[0] === key ? [key, val].join('=') : i.join('='))).join('&');
    }
    location.href = [urlObj.origin, urlObj.pathname, `?${newSearch}`].join('');
  }

  function changeHost(newHost) {
    const { urlObj, search } = getUrlInfo();
    const host = newHost || ONLINE_HOST[0];
    location.href = [urlObj.protocol, '//', host, urlObj.pathname, `?${search}`].join('');
  }

  function nextPage() {
    const { pageNum } = getUrlInfo();
    if (pageNum === '00') return changeSearchQuery('pn', '10');
    const realPageNum = Number.parseInt(pageNum, 10) / 10;
    const nextPageNum = realPageNum + 1 + '0';
    return changeSearchQuery('pn', nextPageNum);
  }

  function prevPage() {
    const { pageNum } = getUrlInfo();
    if (pageNum === '00') return;
    const realPageNum = Number.parseInt(pageNum, 10) / 10;
    const nextPageNum = realPageNum === 1 ? '' : realPageNum - 1 + '0';
    return changeSearchQuery('pn', nextPageNum);
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

  async function getAlwaysLog() {
    const obj = await storageGet('alwaysLogCard');
    const v = obj['alwaysLogCard'];
    return v === true || v === '1';
  }

  async function setAlwaysLog(val) {
    await storageSet({ alwaysLogCard: !!val });
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

    const alwaysLog = await getAlwaysLog();
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

  // 暴露 API 给 popup：通过消息通信
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    (async () => {
      try {
        const { cmd, payload } = msg || {};
        switch (cmd) {
          case 'get_state':
            return sendResponse({ ok: true, data: await getState() });
          case 'change_search_query':
            changeSearchQuery(payload?.key, payload?.val);
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
            return sendResponse({ ok: true });
          case 'export_storage':
            return sendResponse({ ok: true, data: await exportStorage() });
          case 'import_storage':
            await importStorage(payload?.data);
            return sendResponse({ ok: true });
          case 'delete_sids':
            await deleteSids(...(payload?.sids || []));
            return sendResponse({ ok: true });
          case 'delete_words_by_index':
            await deleteWordsByIndex(...(payload?.idxList || []));
            return sendResponse({ ok: true });
          case 'log_card':
            return sendResponse({ ok: true, data: logCard() });
          case 'locate_card':
            return sendResponse({
              ok: true,
              data: locateCard(payload?.tplID, payload?.order || 1),
            });
          case 'set_always_log':
            await setAlwaysLog(!!payload?.val);
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

  // 页面加载时，必要的自动行为
  try {
    const isOnlineHost = ONLINE_HOST.includes(location.host);
    getAlwaysLog()
      .then(val => {
        if (isOnlineHost || val) logCard();
      })
      .catch(() => {});
  } catch (e) {
    console.warn('init log failed:', e);
  }
})();
