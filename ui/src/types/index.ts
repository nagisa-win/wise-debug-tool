/**
 * 扩展弹窗需要展示与页面相关的一些状态。
 * 与 content 脚本中的状态结构保持一致，便于类型检查与重构。
 */
export type State = {
  host: string;
  isPC: boolean;
  ONLINE_HOST: string[];
  sid?: string;
  word?: string;
  curWordKey: 'wd' | 'word' | string;
  pageNum: string;
  storedSids: (string | number)[];
  storedWords: string[];
  alwaysLog: boolean;
  isOnlineHost: boolean;
};

/**
 * 与 content 脚本通信的统一入口。
 * - `cmd` 为指令名称；
 * - `payload` 为负载；
 * - 返回值按指令类型推导。
 */
export type ContentCommand =
  | 'get_state'
  | 'change_search_query'
  | 'clear_storage'
  | 'next_page'
  | 'prev_page'
  | 'change_host'
  | 'log_card'
  | 'locate_card'
  | 'export_storage'
  | 'import_storage'
  | 'set_always_log'
  | 'scroll_to_top';

export type CommandPayloadMap = {
  get_state: undefined;
  change_search_query: { key: string; val: string };
  clear_storage: { key?: 'sids' | 'words' } | undefined;
  next_page: undefined;
  prev_page: undefined;
  change_host: undefined;
  log_card: undefined;
  locate_card: { tplID: string; order: number };
  export_storage: undefined;
  import_storage: { data: string };
  set_always_log: { val: boolean };
};

export type CommandResponseMap = {
  get_state: State;
  change_search_query: true;
  clear_storage: true;
  next_page: true;
  prev_page: true;
  change_host: true;
  log_card: true;
  locate_card: true;
  export_storage: { sids: any[]; words: string[] };
  import_storage: true;
  set_always_log: true;
};
