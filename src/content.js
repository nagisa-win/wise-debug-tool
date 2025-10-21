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

  function clearStorage(key) {
    if (!key) {
      window.localStorage.removeItem('sids');
      window.localStorage.removeItem('words');
      return;
    }
    window.localStorage.removeItem(key);
  }

  function exportStorage() {
    const sids = window.localStorage.getItem('sids');
    const words = window.localStorage.getItem('words');
    const res = { sids: json(sids) || [], words: json(words) || [] };
    return res;
  }

  function importStorage(res) {
    const data = typeof res === 'string' ? json(res) : res;
    const { sids = [], words = [] } = data || {};
    window.localStorage.setItem('sids', JSON.stringify(sids));
    window.localStorage.setItem('words', JSON.stringify(words));
    location.reload();
  }

  function deleteSids(...sids) {
    const memo = window.localStorage.getItem('sids');
    let memoArr = json(memo) || [];
    memoArr = memoArr.filter(i => !sids.map(Number).includes(+i));
    window.localStorage.setItem('sids', JSON.stringify(memoArr));
  }

  function deleteWordsByIndex(...idxList) {
    const memo = window.localStorage.getItem('words');
    const memoArr = json(memo) || [];
    const newArr = [];
    memoArr.forEach((w, i) => {
      if (!idxList.includes(i)) newArr.push(w);
    });
    window.localStorage.setItem('words', JSON.stringify(newArr));
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

  function getState() {
    const { urlObj, sid, curWordKey, word, pageNum } = getUrlInfo();
    let storedSids = window.localStorage.getItem('sids') || '';
    storedSids = json(storedSids) || [];
    if (sid && !storedSids.includes(sid)) storedSids.push(sid);
    storedSids.sort((a, b) => Number.parseInt(a) - Number.parseInt(b));
    let storedWords = window.localStorage.getItem('words') || '';
    storedWords = json(storedWords) || [];
    if (word && !storedWords.includes(word)) storedWords.push(word);
    const alwaysLog = window.localStorage.getItem('alwaysLogCard') === '1';
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

  function setAlwaysLog(val) {
    window.localStorage.setItem('alwaysLogCard', val ? '1' : '0');
  }

  // 暴露 API 给 popup：通过消息通信
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    (async () => {
      try {
        const { cmd, payload } = msg || {};
        switch (cmd) {
          case 'get_state':
            return sendResponse({ ok: true, data: getState() });
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
            clearStorage(payload?.key);
            return sendResponse({ ok: true });
          case 'export_storage':
            return sendResponse({ ok: true, data: exportStorage() });
          case 'import_storage':
            importStorage(payload?.data);
            return sendResponse({ ok: true });
          case 'delete_sids':
            deleteSids(...(payload?.sids || []));
            return sendResponse({ ok: true });
          case 'delete_words_by_index':
            deleteWordsByIndex(...(payload?.idxList || []));
            return sendResponse({ ok: true });
          case 'log_card':
            return sendResponse({ ok: true, data: logCard() });
          case 'locate_card':
            return sendResponse({
              ok: true,
              data: locateCard(payload?.tplID, payload?.order || 1),
            });
          case 'set_always_log':
            setAlwaysLog(!!payload?.val);
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
    const state = getState();
    if (state.isOnlineHost || state.alwaysLog) {
      logCard();
    }
  } catch (e) {
    console.warn('init log failed:', e);
  }
})();
