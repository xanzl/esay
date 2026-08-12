export interface HubInstance {
  id: string
  url: string
}

export interface HubEchoTag {
  id: string
  name: string
  created_at?: number | string
  usage_count?: number
}

export interface HubEchoFile {
  id: string
  name: string
  key: string
  storage_type: string
  url: string
  content_type: string
  category: string
  size: number
  width: number
  height: number
}

/** ech0 实例 /api/echo/query 返回的帖子条目 */
export interface HubEcho {
  id: string
  content: string
  username?: string
  created_at: number | string
  fav_count?: number
  tags?: HubEchoTag[]
  echo_files?: HubEchoFile[]
  layout?: string
  extension?: unknown
  private?: boolean
  user_id?: string
}

/** ech0 统一响应信封 { code: 1, msg, data } */
export interface ApiResult<T> {
  code: number
  msg: string
  data: T
}

export interface EchoQueryPage {
  total: number
  items: HubEcho[]
}

export interface HubConnect {
  server_name: string
  server_url: string
  logo: string
  total_echos: number
  today_echos: number
  sys_username: string
  version: string
}

/** 归并流中的条目（附带来源实例信息） */
export interface HubFeedEcho extends HubEcho {
  username: string
  private: boolean
  user_id: string
  fav_count: number
  tags: HubEchoTag[]
  createdTs: number
  server_name: string
  server_url: string
  virtual_key: string
  logo: string
}