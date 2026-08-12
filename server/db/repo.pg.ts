import { and, desc, eq, gte, inArray, lt, or, sql, type SQL } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.pg'
import type { CommentRow, CommentStatus, DbRepo, PostCursor, PostExtension, PostRow, TagRow, UserPatch, UserRow } from './types'
import { generatePostId } from '../utils/uuidv7'
import { parseImages, parseExtension, toPost, toTag, toUser, toComment } from './repo.shared'

let sqlClient: ReturnType<typeof postgres> | null = null

/**
 * 幂等建表结果缓存：进程内只执行一次（PostgreSQL 与 D1 不同，无 per-binding 概念）。
 */
let pgSchemaReady: Promise<void> | null = null

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nickname      TEXT,
  email         TEXT,
  website       TEXT,
  avatar_url    TEXT,
  bio           TEXT,
  created_at    BIGINT NOT NULL
);`,
  // 旧库补列（幂等）
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS website TEXT;`,
  `CREATE TABLE IF NOT EXISTS posts (
  id         TEXT PRIMARY KEY,
  content    TEXT NOT NULL DEFAULT '',
  images     TEXT NOT NULL DEFAULT '[]',
  private    BOOLEAN NOT NULL DEFAULT FALSE,
  extension  TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);`,
  // 旧库补列（幂等）
  `ALTER TABLE posts ADD COLUMN IF NOT EXISTS private BOOLEAN NOT NULL DEFAULT FALSE;`,
  `ALTER TABLE posts ADD COLUMN IF NOT EXISTS extension TEXT;`,
  `CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);`,
  `CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);`,
  `CREATE TABLE IF NOT EXISTS extension_cache (
  key        TEXT PRIMARY KEY,
  payload    TEXT NOT NULL,
  created_at BIGINT NOT NULL
);`,
  `CREATE TABLE IF NOT EXISTS comments (
  id         TEXT PRIMARY KEY,
  post_id    TEXT NOT NULL,
  parent_id  TEXT,
  nickname   TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL DEFAULT '',
  website    TEXT NOT NULL DEFAULT '',
  content    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'approved',
  ip_hash    TEXT NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);`,
  `CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);`,
  // 旧库补列（幂等）
  `ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id TEXT;`,
  `ALTER TABLE comments ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';`,
  `ALTER TABLE comments ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved';`,
  `CREATE TABLE IF NOT EXISTS likes (
  post_id    TEXT NOT NULL,
  ip_hash    TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (post_id, ip_hash)
);`,
  `CREATE TABLE IF NOT EXISTS tags (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  created_at BIGINT NOT NULL
);`,
  `CREATE TABLE IF NOT EXISTS post_tags (
  post_id TEXT NOT NULL,
  tag_id  TEXT NOT NULL,
  sort    BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (post_id, tag_id)
);`,
  `CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON post_tags(tag_id);`,
  // 旧库补列（幂等）
  `ALTER TABLE post_tags ADD COLUMN IF NOT EXISTS sort BIGINT NOT NULL DEFAULT 0;`,
]

function ensurePgSchema(): Promise<void> {
  if (!pgSchemaReady && sqlClient) {
    pgSchemaReady = (async () => {
      // 逐条执行：Neon 连接池（pgbouncer 事务池）不支持整串多语句 simple query
      for (const statement of SCHEMA_STATEMENTS) {
        await sqlClient.unsafe(statement)
      }
    })().catch((error: unknown) => {
      pgSchemaReady = null
      throw error
    })
  }
  return pgSchemaReady ?? Promise.resolve()
}





async function attachTagsToPosts(
  db: PostgresJsDatabase<typeof schema>,
  posts: PostRow[],
): Promise<void> {
  if (!posts.length) return
  const ids = posts.map((p) => p.id)
  const rows = await db
    .select({ postId: schema.postTags.postId, tag: schema.tags })
    .from(schema.postTags)
    .innerJoin(schema.tags, eq(schema.postTags.tagId, schema.tags.id))
    .where(inArray(schema.postTags.postId, ids))
    .orderBy(schema.postTags.sort)
  const map = new Map<string, TagRow[]>()
  for (const row of rows) {
    const list = map.get(row.postId) ?? []
    list.push(toTag(row.tag))
    map.set(row.postId, list)
  }
  for (const post of posts) {
    post.tags = map.get(post.id) ?? []
  }
}

async function ensureTag(
  db: PostgresJsDatabase<typeof schema>,
  name: string,
): Promise<TagRow> {
  const existing = await db.select().from(schema.tags).where(eq(schema.tags.name, name)).limit(1)
  if (existing[0]) return toTag(existing[0])
  const inserted = await db
    .insert(schema.tags)
    .values({ id: generatePostId(), name, createdAt: Date.now() })
    .onConflictDoNothing()
    .returning()
  if (inserted[0]) return toTag(inserted[0])
  const re = await db.select().from(schema.tags).where(eq(schema.tags.name, name)).limit(1)
  return toTag(re[0])
}

async function replacePostTags(
  db: PostgresJsDatabase<typeof schema>,
  postId: string,
  tagNames: string[],
): Promise<TagRow[]> {
  await db.delete(schema.postTags).where(eq(schema.postTags.postId, postId))
  const tags: TagRow[] = []
  for (const [index, name] of tagNames.entries()) {
    const tag = await ensureTag(db, name)
    tags.push(tag)
    await db
      .insert(schema.postTags)
      .values({ postId, tagId: tag.id, sort: index })
      .onConflictDoNothing()
  }
  return tags
}




export function createPgRepo(databaseUrl: string): DbRepo {
  sqlClient ??= postgres(databaseUrl, { max: 1, prepare: false, idle_timeout: 20, connect_timeout: 30 })
  const db: PostgresJsDatabase<typeof schema> = drizzle(sqlClient, { schema })

  return {
    async getUserByUsername(username) {
      await ensurePgSchema()
      const rows = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1)
      return rows[0] ? toUser(rows[0]) : null
    },

    async getUserById(id) {
      await ensurePgSchema()
      const rows = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1)
      return rows[0] ? toUser(rows[0]) : null
    },

    async countUsers() {
      await ensurePgSchema()
      const rows = await db.select({ count: sql<number>`count(*)` }).from(schema.users)
      return Number(rows[0]?.count ?? 0)
    },

    async createUser(input) {
      await ensurePgSchema()
      const rows = await db
        .insert(schema.users)
        .values({
          username: input.username,
          passwordHash: input.passwordHash,
          nickname: input.nickname,
          avatarUrl: input.avatarUrl,
          bio: input.bio,
          createdAt: Date.now(),
        })
        .returning()
      return toUser(rows[0])
    },

    async updateUser(id, patch: UserPatch) {
      await ensurePgSchema()
      const rows = await db
        .update(schema.users)
        .set({
          ...(patch.username !== undefined ? { username: patch.username } : {}),
          ...(patch.password_hash !== undefined ? { passwordHash: patch.password_hash } : {}),
          ...(patch.nickname !== undefined ? { nickname: patch.nickname } : {}),
          ...(patch.email !== undefined ? { email: patch.email } : {}),
          ...(patch.website !== undefined ? { website: patch.website } : {}),
          ...(patch.avatar_url !== undefined ? { avatarUrl: patch.avatar_url } : {}),
          ...(patch.bio !== undefined ? { bio: patch.bio } : {}),
        })
        .where(eq(schema.users.id, id))
        .returning()
      return rows[0] ? toUser(rows[0]) : null
    },

    async getSite() {
      await ensurePgSchema()
      const rows = await db.select().from(schema.users).orderBy(sql`${schema.users.id} asc`).limit(1)
      if (!rows[0]) return null
      return {
        username: rows[0].username,
        nickname: rows[0].nickname,
        avatar_url: rows[0].avatarUrl,
        bio: rows[0].bio,
      }
    },

    async listPosts({ limit, cursor }) {
      await ensurePgSchema()
      const conds = cursor
        ? [or(lt(schema.posts.createdAt, cursor.createdAt), and(eq(schema.posts.createdAt, cursor.createdAt), lt(schema.posts.id, cursor.id)))]
        : []
      const rows = await db
        .select()
        .from(schema.posts)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(schema.posts.createdAt), desc(schema.posts.id))
        .limit(limit + 1)
      const hasMore = rows.length > limit
      const page = rows.slice(0, limit)
      const last = page[page.length - 1]
      const posts = page.map((row) => toPost(row))
      await attachTagsToPosts(db, posts)
      return {
        posts,
        nextCursor: last ? { createdAt: last.createdAt, id: last.id } : null,
        hasMore,
      }
    },

    async getPost(id) {
      await ensurePgSchema()
      const rows = await db.select().from(schema.posts).where(eq(schema.posts.id, id)).limit(1)
      if (!rows[0]) return null
      const post = toPost(rows[0])
      await attachTagsToPosts(db, [post])
      return post
    },

    async createPost({ content, images, tagNames, private: isPrivate, extension, now }) {
      await ensurePgSchema()
      const rows = await db
        .insert(schema.posts)
        .values({
          id: generatePostId(),
          content,
          images: JSON.stringify(images),
          private: isPrivate,
          extension: extension ? JSON.stringify(extension) : null,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
      const post = toPost(rows[0])
      post.tags = await replacePostTags(db, post.id, tagNames)
      return post
    },

    async updatePost(id, patch) {
      await ensurePgSchema()
      const rows = await db
        .update(schema.posts)
        .set({
          ...(patch.content !== undefined ? { content: patch.content } : {}),
          ...(patch.images !== undefined ? { images: JSON.stringify(patch.images) } : {}),
          ...(patch.private !== undefined ? { private: patch.private } : {}),
          ...(patch.extension !== undefined
            ? { extension: patch.extension ? JSON.stringify(patch.extension) : null }
            : {}),
          updatedAt: Date.now(),
        })
        .where(eq(schema.posts.id, id))
        .returning()
      if (!rows[0]) return null
      const post = toPost(rows[0])
      if (patch.tagNames !== undefined) {
        post.tags = await replacePostTags(db, post.id, patch.tagNames)
      } else {
        await attachTagsToPosts(db, [post])
      }
      return post
    },

    async deletePost(id) {
      await ensurePgSchema()
      const rows = await db.delete(schema.posts).where(eq(schema.posts.id, id)).returning({ id: schema.posts.id })
      return rows.length > 0
    },

    async searchPosts(keyword, limit, since, tagNames) {
      await ensurePgSchema()
      const conds: SQL<unknown>[] = []
      const kw = keyword.trim()
      if (kw) {
        const escaped = kw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
        conds.push(sql`${schema.posts.content} ILIKE ${`%${escaped}%`} ESCAPE '\\'`)
      }
      if (since) conds.push(gte(schema.posts.createdAt, since))
      const names = tagNames?.length
        ? [...new Set(tagNames.map((n) => n.trim()).filter(Boolean))]
        : []
      if (names.length) {
        const tagRows = await db
          .select({ id: schema.tags.id })
          .from(schema.tags)
          .where(inArray(schema.tags.name, names))
        const ids = tagRows.map((r) => r.id)
        if (ids.length) {
          conds.push(
            sql`exists (select 1 from post_tags pt where pt.post_id = ${schema.posts.id} and pt.tag_id in ${ids})`,
          )
        } else {
          conds.push(sql`1 = 0`)
        }
      }
      const rows = await db
        .select()
        .from(schema.posts)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(schema.posts.createdAt), desc(schema.posts.id))
        .limit(limit)
      const posts = rows.map((row) => toPost(row))
      await attachTagsToPosts(db, posts)
      return posts
    },

    async countPosts() {
      await ensurePgSchema()
      const rows = await db.select({ count: sql<number>`count(*)` }).from(schema.posts)
      return Number(rows[0]?.count ?? 0)
    },

    async countPostsSince(since) {
      await ensurePgSchema()
      const rows = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.posts)
        .where(gte(schema.posts.createdAt, since))
      return Number(rows[0]?.count ?? 0)
    },

    async countComments() {
      await ensurePgSchema()
      const rows = await db.select({ count: sql<number>`count(*)` }).from(schema.comments)
      return Number(rows[0]?.count ?? 0)
    },

    async countLikes() {
      await ensurePgSchema()
      const rows = await db.select({ count: sql<number>`count(*)` }).from(schema.likes)
      return Number(rows[0]?.count ?? 0)
    },

    async countTags() {
      await ensurePgSchema()
      const rows = await db.select({ count: sql<number>`count(*)` }).from(schema.tags)
      return Number(rows[0]?.count ?? 0)
    },

    async listCommentsByPost(postId) {
      await ensurePgSchema()
      const rows = await db
        .select()
        .from(schema.comments)
        .where(eq(schema.comments.postId, postId))
        .orderBy(schema.comments.createdAt)
      return rows.map(toComment)
    },

    async getComment(id) {
      await ensurePgSchema()
      const rows = await db.select().from(schema.comments).where(eq(schema.comments.id, id)).limit(1)
      return rows[0] ? toComment(rows[0]) : null
    },

    async createComment({ postId, parentId, nickname, email, website, content, status, ipHash, now }) {
      await ensurePgSchema()
      const rows = await db
        .insert(schema.comments)
        .values({
          id: generatePostId(),
          postId,
          parentId,
          nickname,
          email,
          website,
          content,
          status,
          ipHash,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
      return toComment(rows[0])
    },

    async updateCommentStatus(id, status) {
      await ensurePgSchema()
      const rows = await db
        .update(schema.comments)
        .set({ status, updatedAt: Date.now() })
        .where(eq(schema.comments.id, id))
        .returning()
      return rows[0] ? toComment(rows[0]) : null
    },

    async deleteComment(id) {
      await ensurePgSchema()
      const rows = await db.delete(schema.comments).where(eq(schema.comments.id, id)).returning({ id: schema.comments.id })
      return rows.length > 0
    },

    async getLikesInfo(postIds, ipHash) {
      await ensurePgSchema()
      if (!postIds.length) return new Map()
      const counts = await db
        .select({ postId: schema.likes.postId, count: sql<number>`count(*)` })
        .from(schema.likes)
        .where(inArray(schema.likes.postId, postIds))
        .groupBy(schema.likes.postId)
      const liked = await db
        .select({ postId: schema.likes.postId })
        .from(schema.likes)
        .where(and(inArray(schema.likes.postId, postIds), eq(schema.likes.ipHash, ipHash)))
      const likedSet = new Set(liked.map((r) => r.postId))
      const map = new Map<string, { count: number; liked: boolean }>()
      for (const id of postIds) {
        const c = counts.find((r) => r.postId === id)
        map.set(id, { count: Number(c?.count ?? 0), liked: likedSet.has(id) })
      }
      return map
    },

    async toggleLike(postId, ipHash, now) {
      await ensurePgSchema()
      const existing = await db
        .select()
        .from(schema.likes)
        .where(and(eq(schema.likes.postId, postId), eq(schema.likes.ipHash, ipHash)))
        .limit(1)
      if (existing.length) {
        await db
          .delete(schema.likes)
          .where(and(eq(schema.likes.postId, postId), eq(schema.likes.ipHash, ipHash)))
      } else {
        await db.insert(schema.likes).values({ postId, ipHash, createdAt: now })
      }
      const countRows = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.likes)
        .where(eq(schema.likes.postId, postId))
      return { liked: existing.length === 0, count: Number(countRows[0]?.count ?? 0) }
    },

    async listTags(limit = 50) {
      await ensurePgSchema()
      const rows = await db.select().from(schema.tags).orderBy(schema.tags.name).limit(limit)
      return rows.map(toTag)
    },

    async deleteTag(id) {
      await ensurePgSchema()
      await db.delete(schema.postTags).where(eq(schema.postTags.tagId, id))
      const rows = await db.delete(schema.tags).where(eq(schema.tags.id, id)).returning({ id: schema.tags.id })
      return rows.length > 0
    },

    async getSetting(key) {
      await ensurePgSchema()
      const rows = await db.select().from(schema.settings).where(eq(schema.settings.key, key)).limit(1)
      return rows[0]?.value ?? null
    },

    async setSetting(key, value) {
      await ensurePgSchema()
      await db
        .insert(schema.settings)
        .values({ key, value })
        .onConflictDoUpdate({ target: schema.settings.key, set: { value } })
    },

    async getCache(key) {
      await ensurePgSchema()
      const rows = await db.select().from(schema.extensionCache).where(eq(schema.extensionCache.key, key)).limit(1)
      const row = rows[0]
      return row ? { payload: row.payload, createdAt: row.createdAt } : null
    },

    async setCache(key, payload, now) {
      await ensurePgSchema()
      await db
        .insert(schema.extensionCache)
        .values({ key, payload, createdAt: now })
        .onConflictDoUpdate({
          target: schema.extensionCache.key,
          set: { payload, createdAt: now },
        })
    },
  }
}
