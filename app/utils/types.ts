export interface PostExtension {
  type: 'WEBSITE' | 'GITHUBPROJ' | 'MUSIC' | 'VIDEO' | 'LOCATION' | 'TWEET'
  payload: Record<string, string | number>
}

export interface Post {
  id: string
  content: string
  images: string[]
  tags: { id: string; name: string }[]
  private: boolean
  extension: PostExtension | null
  created_at: number
  updated_at: number
  like_count: number
  liked: boolean
}

export interface User {
  id: number
  username: string
  nickname: string | null
  email: string | null
  website: string | null
  avatar_url: string | null
  bio: string | null
}

/** 站点公开信息（无登录时展示博主身份） */
export interface SiteInfo {
  username: string
  nickname: string | null
  avatar_url: string | null
  bio: string | null
}

/** 数据库连通性检查结果 */
export interface DbHealth {
  dbConnected: boolean
  dbType: 'd1' | 'postgresql'
  reason?: 'missing_d1_binding' | 'missing_database_url' | 'connect_error'
  message?: string
}

/** 评论（公开投影：不含邮箱/IP） */
export interface PostComment {
  id: string
  post_id: string
  parent_id: string | null
  nickname: string
  website: string
  content: string
  status: 'pending' | 'approved' | 'rejected'
  /** 邮箱 MD5（WeAvatar 头像源），空串表示未填邮箱 */
  avatar: string
  created_at: number
  updated_at: number
}

/** 评论站点设置 */
export interface CommentSettings {
  enable_comment: boolean
  require_approval: boolean
}

/** 公开配置 */
export interface PublicConfig {
  comments_enabled: boolean
  require_approval: boolean
  turnstile_site_key: string
  turnstile_enabled: boolean
  login_turnstile_enabled: boolean
}
