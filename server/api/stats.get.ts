import type { H3Event } from 'h3'
import { getRepo } from '../db/client'

/** 控制台统计（站长） */
export default defineEventHandler(async (event: H3Event) => {
  const repo = getRepo(event)
  const now = Date.now()
  const dayStart = now - (now % 86400000)
  const [posts, todayPosts, comments, likes, tags, users] = await Promise.all([
    repo.countPosts(),
    repo.countPostsSince(dayStart),
    repo.countComments(),
    repo.countLikes(),
    repo.countTags(),
    repo.countUsers(),
  ])
  return {
    posts,
    today_posts: todayPosts,
    comments,
    likes,
    tags,
    users,
  }
})