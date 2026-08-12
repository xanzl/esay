export interface PostExtension {
  type: 'WEBSITE' | 'GITHUBPROJ' | 'MUSIC' | 'VIDEO' | 'LOCATION' | 'TWEET'
  payload: Record<string, string | number>
}

export interface PostRow {
  id: string
  content: string
  images: string[]
  private: boolean
  extension: PostExtension | null
  tags: TagRow[]
  created_at: number
  updated_at: number
}

export interface TagRow {
  id: string
  name: string
}

export interface UserRow {
  id: number
  username: string
  password_hash: string
  nickname: string | null
  email: string | null
  website: string | null
  avatar_url: string | null
  bio: string | null
  created_at: number
}

export interface PostCursor {
  createdAt: number
  id: string
}

export interface CommentRow {
  id: string
  post_id: string
  parent_id: string | null
  nickname: string
  website: string
  content: string
  status: 'pending' | 'approved' | 'rejected'
  /** 评论者邮箱的 MD5（WeAvatar/Gravatar 头像源，公开安全；空串表示未填邮箱） */
  avatar: string
  created_at: number
  updated_at: number
}

export type CommentStatus = CommentRow['status']

export interface UserPatch {
  username?: string
  password_hash?: string
  nickname?: string | null
  email?: string | null
  website?: string | null
  avatar_url?: string | null
  bio?: string | null
}

export interface DbRepo {
  getUserByUsername(username: string): Promise<UserRow | null>
  getUserById(id: number): Promise<UserRow | null>
  countUsers(): Promise<number>
  createUser(input: {
    username: string
    passwordHash: string
    nickname: string | null
    avatarUrl: string | null
    bio: string | null
  }): Promise<UserRow>
  updateUser(id: number, patch: UserPatch): Promise<UserRow | null>
  getSite(): Promise<{ username: string; nickname: string | null; avatar_url: string | null; bio: string | null } | null>
  listPosts(input: { limit: number; cursor: PostCursor | null }): Promise<{
    posts: PostRow[]
    nextCursor: PostCursor | null
    hasMore: boolean
  }>
  getPost(id: string): Promise<PostRow | null>
  createPost(input: {
    content: string
    images: string[]
    tagNames: string[]
    private: boolean
    extension: PostExtension | null
    now: number
  }): Promise<PostRow>
  updatePost(id: string, patch: {
    content?: string
    images?: string[]
    tagNames?: string[]
    private?: boolean
    extension?: PostExtension | null
  }): Promise<PostRow | null>
  deletePost(id: string): Promise<boolean>
  listTags(limit?: number): Promise<TagRow[]>
  deleteTag(id: string): Promise<boolean>
  searchPosts(keyword: string, limit: number, since?: number, tagNames?: string[]): Promise<PostRow[]>
  countPosts(): Promise<number>
  countPostsSince(since: number): Promise<number>
  countComments(): Promise<number>
  countLikes(): Promise<number>
  countTags(): Promise<number>
  listCommentsByPost(postId: string): Promise<CommentRow[]>
  getComment(id: string): Promise<CommentRow | null>
  createComment(input: {
    postId: string
    parentId: string | null
    nickname: string
    email: string
    website: string
    content: string
    status: CommentStatus
    ipHash: string
    now: number
  }): Promise<CommentRow>
  updateCommentStatus(id: string, status: CommentStatus): Promise<CommentRow | null>
  deleteComment(id: string): Promise<boolean>
  getLikesInfo(postIds: string[], ipHash: string): Promise<Map<string, { count: number; liked: boolean }>>
  toggleLike(postId: string, ipHash: string, now: number): Promise<{ liked: boolean; count: number }>
  getSetting(key: string): Promise<string | null>
  setSetting(key: string, value: string): Promise<void>
  getCache(key: string): Promise<{ payload: string; createdAt: number } | null>
  setCache(key: string, payload: string, now: number): Promise<void>
}
