import { pgTable, serial, text, bigint, primaryKey, boolean } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  nickname: text('nickname'),
  email: text('email'),
  website: text('website'),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
})

export const posts = pgTable('posts', {
  id: text('id').primaryKey(),
  content: text('content').notNull().default(''),
  images: text('images').notNull().default('[]'),
  private: boolean('private').notNull().default(false),
  extension: text('extension'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
})

export const settings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

export const extensionCache = pgTable('extension_cache', {
  key: text('key').primaryKey(),
  payload: text('payload').notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
})

export const comments = pgTable('comments', {
  id: text('id').primaryKey(),
  postId: text('post_id').notNull(),
  parentId: text('parent_id'),
  nickname: text('nickname').notNull().default(''),
  email: text('email').notNull().default(''),
  website: text('website').notNull().default(''),
  content: text('content').notNull(),
  status: text('status').notNull().default('approved'),
  ipHash: text('ip_hash').notNull().default(''),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
})

export const likes = pgTable(
  'likes',
  {
    postId: text('post_id').notNull(),
    ipHash: text('ip_hash').notNull(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  },
  (t) => [primaryKey(t.postId, t.ipHash)],
)

export const tags = pgTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
})

export const postTags = pgTable(
  'post_tags',
  {
    postId: text('post_id').notNull(),
    tagId: text('tag_id').notNull(),
    sort: bigint('sort', { mode: 'number' }).notNull().default(0),
  },
  (t) => [primaryKey(t.postId, t.tagId)],
)

export type Post = typeof posts.$inferSelect
export type User = typeof users.$inferSelect
