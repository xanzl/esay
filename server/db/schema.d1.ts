import { sqliteTable, integer, primaryKey, text } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  nickname: text('nickname'),
  email: text('email'),
  website: text('website'),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  createdAt: integer('created_at').notNull(),
})

export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  content: text('content').notNull().default(''),
  images: text('images').notNull().default('[]'),
  private: integer('private').notNull().default(0),
  extension: text('extension'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const settings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

export const extensionCache = sqliteTable('extension_cache', {
  key: text('key').primaryKey(),
  payload: text('payload').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const comments = sqliteTable('comments', {
  id: text('id').primaryKey(),
  postId: text('post_id').notNull(),
  parentId: text('parent_id'),
  nickname: text('nickname').notNull().default(''),
  email: text('email').notNull().default(''),
  website: text('website').notNull().default(''),
  content: text('content').notNull(),
  status: text('status').notNull().default('approved'),
  ipHash: text('ip_hash').notNull().default(''),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const likes = sqliteTable(
  'likes',
  {
    postId: text('post_id').notNull(),
    ipHash: text('ip_hash').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [primaryKey(t.postId, t.ipHash)],
)

export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: integer('created_at').notNull(),
})

export const postTags = sqliteTable(
  'post_tags',
  {
    postId: text('post_id').notNull(),
    tagId: text('tag_id').notNull(),
    sort: integer('sort').notNull().default(0),
  },
  (t) => [primaryKey(t.postId, t.tagId)],
)

export type Post = typeof posts.$inferSelect
export type User = typeof users.$inferSelect
